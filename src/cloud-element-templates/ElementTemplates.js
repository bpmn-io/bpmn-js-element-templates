import {
  isArray,
  isObject,
  isString
} from 'min-dash';

import { isAny } from 'bpmn-js/lib/util/ModelUtil';

import {
  getTemplateId,
  getTemplateVersion
} from './Helper';

import {
  isConditionMet as isConditionMetUtil
} from './Condition';

import {
  shouldCastToFeel,
  toFeelExpression
} from './util/FeelUtil';

import {
  getPropertyValue as getPropertyValueUtil,
  setPropertyValue as setPropertyValueUtil,
  validateProperty as validatePropertyUtil
} from './util/propertyUtil';

import { default as DefaultElementTemplates } from '../element-templates/ElementTemplates';

import { isTimerTemplateApplicable } from './util/timerUtil';

import { getUpdateSteps } from './util/updatePathsUtil';

/**
 * @typedef {import('bpmn-js/lib/model/Types').Element} Element
 * @typedef {import('./util/updatePathsUtil').UpdateStep} UpdateStep
 */

/**
 * @typedef {Object} UpdateDetails
 * @property {string} [message] shown where a migration is offered
 * @property {Array<Change>} changes authored changes, oldest first
 *
 * @typedef {Object} Change
 * @property {'update'|'migration'} type
 * @property {ElementTemplate} template latest version of the template declaring the change
 * @property {number} [version] version the update was introduced in
 * @property {string} text human readable change
 *
 * @typedef {Object} ElementTemplateOptions
 * @property {string} [presetId] Preset to apply on top of the template
 */

/**
 * Filters to determine whether a template is applicable to a given element.
 * @type {Array<(template: ElementTemplate, element: Element) => boolean>}
 */
const TEMPLATE_FILTERS = [
  isTimerTemplateApplicable
];

/**
 * Registry for element templates.
 */
export default class ElementTemplates extends DefaultElementTemplates {
  constructor(templateElementFactory, commandStack, eventBus, modeling, injector, translate, config) {
    super(commandStack, eventBus, modeling, injector, config);

    this._templateElementFactory = templateElementFactory;
    this._translate = translate;

    this._migrationTargetsById = Object.create(null);
  }

  /**
   * Set templates.
   *
   * @param {Array<ElementTemplate>} templates
   */
  set(templates) {

    // index the templates elements may migrate to, by the id of their template
    this._migrationTargetsById = buildMigrationTargetsById(templates);

    super.set(templates);
  }

  _getTemplateId(element) {
    return getTemplateId(element);
  }

  _getTemplateVersion(element) {
    return getTemplateVersion(element);
  }

  /**
   * Get all templates (with given ID or applicable to element).
   *
   * @param {string|djs.model.Base} [elementOrTemplateId]
   * @return {Array<ElementTemplate>}
   */
  getAll(elementOrTemplateId) {
    const templates = super.getAll(elementOrTemplateId);

    if (isObject(elementOrTemplateId)) {
      return this._filterApplicableTemplates(templates, elementOrTemplateId);
    }

    return templates;
  }

  /**
   * Get all templates (with given ID or applicable to element) with the latest version.
   *
   * @param {String|djs.model.Base} [elementOrTemplateId]
   * @param {Object} [options]
   * @param {boolean} [options.deprecated=false] include deprecated versions
   * @param {boolean} [options.incompatible=false] include versions incompatible
   * with the configured `engines`
   *
   * @return {Array<ElementTemplate>}
   */
  getLatest(elementOrTemplateId, options = {}) {
    const templates = super.getLatest(elementOrTemplateId, options);

    if (isObject(elementOrTemplateId)) {
      return this._filterApplicableTemplates(templates, elementOrTemplateId);
    }

    return templates;
  }

  /**
   * Get the version of each template to offer to users under the given engine
   * overrides: the latest compatible one. `deprecated` includes a deprecated
   * latest version.
   *
   * @overload
   * @param {string|djs.model.Base} [elementOrTemplateId]
   * @param {Object} [enginesOverrides]
   * @param { { latest?: true, deprecated?: boolean } } [options]
   *
   * @return {Array<ElementTemplate>}
   */

  /**
   * Get all versions of the templates, regardless of compatibility.
   *
   * @overload
   * @param {string|djs.model.Base|undefined} elementOrTemplateId
   * @param {Object|undefined} enginesOverrides
   * @param { { latest: false } } options
   *
   * @return {Array<ElementTemplate>}
   */

  /**
   * @param {string|djs.model.Base} [elementOrTemplateId]
   * @param {Object} [enginesOverrides]
   * @param { { latest?: boolean, deprecated?: boolean } } [options]
   *
   * @return {Array<ElementTemplate>}
   */
  getCompatible(elementOrTemplateId, enginesOverrides = {}, options = {}) {
    const templates = super.getCompatible(elementOrTemplateId, enginesOverrides, options);

    if (isObject(elementOrTemplateId)) {
      return this._filterApplicableTemplates(templates, elementOrTemplateId);
    }

    return templates;
  }

  /**
   * Get the update available for an element: a migration to another template,
   * if declared, or a newer version of its template.
   *
   * A migration is offered instead of updates, as it includes them.
   *
   * @param {Element} element
   *
   * @return { { type: 'update'|'migration', template: ElementTemplate } | null }
   */
  getUpdate(element) {
    const template = this.get(element);

    if (!template) {
      return null;
    }

    const migration = (this._migrationTargetsById[ template.id ] || [])
      .flatMap(id => this.getLatest(id))
      .find(newTemplate => {
        return isAny(element, newTemplate.appliesTo) &&
          this._filterApplicableTemplates([ newTemplate ], element).length &&
          this._getUpdateSteps(template, newTemplate).length;
      });

    if (migration) {
      return { type: 'migration', template: migration };
    }

    return super.getUpdate(element);
  }

  /**
   * Get what changing an element to a given template means, as declared by the
   * template's update paths. Works for any element and template, and is usually
   * empty.
   *
   * @param {Element} element
   * @param {ElementTemplate} newTemplate
   *
   * @return {UpdateDetails}
   */
  getUpdateDetails(element, newTemplate) {
    const oldTemplate = this.get(element);

    const steps = oldTemplate ? this._getUpdateSteps(oldTemplate, newTemplate) : [];

    const message = steps.map(({ path }) => path.message).find(Boolean);

    const changes = steps.filter(({ path }) => path.changes).map(({ template, path }) => {
      return path.templateId
        ? { type: 'migration', template, text: path.changes }
        : { type: 'update', template, version: path.beforeVersion, text: path.changes };
    });

    return message ? { message, changes } : { changes };
  }

  /**
   * Get the update steps from one template to another. The latest loaded
   * version of the old template, deprecated or incompatible, declares its
   * update history.
   *
   * @param {ElementTemplate} oldTemplate
   * @param {ElementTemplate} newTemplate
   *
   * @return {Array<UpdateStep>}
   */
  _getUpdateSteps(oldTemplate, newTemplate) {
    const [ latestOldTemplate ] = this.getLatest(oldTemplate.id, {
      deprecated: true,
      incompatible: true
    });

    return getUpdateSteps(newTemplate, oldTemplate, latestOldTemplate);
  }

  _filterApplicableTemplates(templates, element) {
    return TEMPLATE_FILTERS.reduce(
      (filteredTemplates, filterFn) =>
        filteredTemplates.filter(template => filterFn(template, element)),
      templates
    );
  }

  /**
   * Create an element based on an element template. This is, for example,
   * called from the create-append anything menu.
   *
   * @param {ElementTemplate} template
   * @param {ElementTemplateOptions} [options]
   *
   * @returns {djs.model.Base}
   */
  createElement(template, options = {}) {
    if (!template) {
      throw new Error('template is missing');
    }

    const element = this._templateElementFactory.create(template, options);

    return element;
  }

  /**
   * Get a template property value from an element.
   *
   * @param {Element} element
   * @param {Object} property
   *
   * @return {*} the property value
   */
  getPropertyValue(element, property) {
    return getPropertyValueUtil(element, property);
  }

  /**
   * Set a template property value on an element.
   *
   * @param {Element} element
   * @param {Object} property
   * @param {*} value
   */
  setPropertyValue(element, property, value) {
    return setPropertyValueUtil(
      this._injector.get('bpmnFactory'),
      this._commandStack,
      element,
      property,
      normalizePropertyValue(value, property)
    );
  }

  /**
   * Validate a template property value.
   *
   * @param {*} value
   * @param {Object} property
   *
   * @return {string|undefined} the validation error
   */
  validateProperty(value, property) {
    return validatePropertyUtil(
      normalizePropertyValue(value, property),
      property,
      this._translate
    );
  }

  /**
   * Check whether a template property condition is met.
   *
   * @param {Element} element
   * @param {Array<Object>} properties
   * @param {Object} property
   *
   * @return {boolean}
   */
  isConditionMet(element, properties, property) {
    return isConditionMetUtil(element, properties, property);
  }

  /**
   * Apply element template to a given element.
   *
   * @param {Element} element
   * @param {ElementTemplate} newTemplate
   * @param {ElementTemplateOptions} [options]
   *
   * @return {Element} the updated element
   */
  applyTemplate(element, newTemplate, options = {}) {
    const oldTemplate = this.get(element);

    const context = {
      element,
      newTemplate,
      oldTemplate,
      options
    };

    const event = oldTemplate?.id === newTemplate?.id ? 'update' : 'apply';

    this._commandStack.execute('propertiesPanel.zeebe.changeTemplate', context);

    this._fire(event, {
      element,
      newTemplate,
      oldTemplate
    });

    return context.element;
  }

  /**
   * Remove template from a given element.
   *
   * @param {Element} element
   *
   * @return {Element} the updated element
   */
  removeTemplate(element) {
    const oldTemplate = this.get(element);

    const context = {
      element,
      oldTemplate
    };

    this._commandStack.execute('propertiesPanel.removeTemplate', context);

    this._fire('remove', {
      element,
      oldTemplate
    });

    return context.element;
  }
}

ElementTemplates.$inject = [
  'templateElementFactory',
  'commandStack',
  'eventBus',
  'modeling',
  'injector',
  'translate',
  'config.elementTemplates',
];

/**
 * Convert a property value to the representation stored in the BPMN model.
 *
 * Empty values stay unchanged so the setter can remove optional properties;
 * all other values are converted to FEEL when required by the property.
 *
 * @param {*} value
 * @param {Object} property
 *
 * @return {*}
 */
function normalizePropertyValue(value, property) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  return shouldCastToFeel(property)
    ? toFeelExpression(value, property.type)
    : value;
}


/**
 * @param {Array<ElementTemplate>} templates
 *
 * @return {Record<string, Array<string>>} ids of the templates to migrate to,
 * by the id of the template to migrate from
 */
function buildMigrationTargetsById(templates) {
  const targetsById = Object.create(null);

  // templates are untrusted input and may have any shape
  for (const template of templates) {
    const updatePaths = isObject(template) && isArray(template.updatePaths) ? template.updatePaths : [];

    for (const path of updatePaths) {
      const templateId = isObject(path) && path.templateId;

      if (!isString(templateId) || templateId === template.id) {
        continue;
      }

      const ids = targetsById[ templateId ] = targetsById[ templateId ] || [];

      if (!ids.includes(template.id)) {
        ids.push(template.id);
      }
    }
  }

  return targetsById;
}
