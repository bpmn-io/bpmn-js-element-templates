import {
  isObject
} from 'min-dash';

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

import { getMigrationSteps, prepareMigration } from './util/migrationUtil';

/**
 * @typedef {import('bpmn-js/lib/model/Types').Element} Element
 */

/**
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
   * @param {{ deprecated?: boolean }} [options]
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
   * Get compatible templates for element with optional engine overrides.
   *
   * @param {String|djs.model.Base} [elementOrTemplateId]
   * @param {Object} [enginesOverrides]
   * @param {Object} [options]
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
   * Get migration targets with their availability message and authored changes.
   *
   * @param {Element} element
   *
   * @return {Array<{ template: ElementTemplate, availabilityMessage: string|undefined, changes: string|undefined }>}
   */
  getMigrations(element) {
    const sourceTemplate = this.get(element);

    if (!sourceTemplate) {
      return [];
    }

    return this.getLatest(element)
      .filter(template => template.id !== sourceTemplate.id)
      .flatMap(template => {
        const steps = getMigrationSteps(template, sourceTemplate);

        return steps.length ? [ {
          template,
          availabilityMessage: steps[0].availabilityMessage || sourceTemplate.deprecated?.message,
          changes: getMigrationChanges(steps)
        } ] : [];
      });
  }

  /**
   * Get the authored, human readable changes of migrating an element
   * to a given template.
   *
   * @param {Element} element
   * @param {ElementTemplate} newTemplate
   *
   * @return {string|undefined}
   */
  getChanges(element, newTemplate) {
    const source = this.get(element);

    if (!source) {
      return;
    }

    return getMigrationChanges(getMigrationSteps(newTemplate, source));
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
    const changes = oldTemplate && newTemplate && this.getChanges(element, newTemplate);

    const context = {
      element,
      newTemplate,
      oldTemplate,
      migratedValues: prepareMigration(element, oldTemplate, newTemplate),
      options
    };

    const event = oldTemplate?.id === newTemplate?.id ? 'update' : 'apply';

    this._commandStack.execute('propertiesPanel.zeebe.changeTemplate', context);

    this._fire(event, {
      element,
      newTemplate,
      oldTemplate,
      ...(changes && { changes })
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

function getMigrationChanges(steps) {
  return steps.map(step => step.changes).filter(Boolean).join('\n\n') || undefined;
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