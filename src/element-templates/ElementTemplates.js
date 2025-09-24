import {
  find,
  isString,
  isUndefined,
  reduce
} from 'min-dash';

import {
  getTemplateId,
  getTemplateVersion,
  findTemplates,
  buildTemplatesById,
  getIncompatibleEngines as _getIncompatibleEngines,
  isCompatible as _isCompatible
} from './Helper';

import { coerce, valid as isSemverValid } from 'semver';

// eslint-disable-next-line no-undef
const packageVersion = process.env.PKG_VERSION;


/**
 * Registry for element templates.
 */
export default class ElementTemplates {
  constructor(commandStack, eventBus, modeling, injector, config) {
    this._commandStack = commandStack;
    this._eventBus = eventBus;
    this._injector = injector;
    this._modeling = modeling;

    this._templatesById = {};
    this._templates = [];

    config = config || {};

    this._engines = this._coerceEngines(config.engines || {});

    eventBus.on('elementTemplates.engines.changed', event => {
      this.set(this._templates);
    });
  }

  /**
   * Get template with given ID and optional version or for element.
   *
   * @param {String|djs.model.Base} elementOrTemplateId
   * @param {number} [version]
   *
   * @return {ElementTemplate}
   */
  get(elementOrTemplateId, version) {
    const templates = this._templatesById;

    let element;

    if (isUndefined(elementOrTemplateId)) {
      return null;
    } else if (isString(elementOrTemplateId)) {

      if (isUndefined(version)) {
        version = '_';
      }

      if (templates[ elementOrTemplateId ] && templates[ elementOrTemplateId ][ version ]) {
        return templates[ elementOrTemplateId ][ version ];
      } else {
        return null;
      }
    } else {
      element = elementOrTemplateId;

      return this.get(this._getTemplateId(element), this._getTemplateVersion(element));
    }
  }

  /**
   * Get default template for given element.
   *
   * @param {djs.model.Base} element
   *
   * @return {ElementTemplate}
   */
  getDefault(element) {
    return find(this.getAll(element), function(template) {
      return template.isDefault;
    }) || null;
  }

  /**
   * Get all templates (with given ID or applicable to element).
   *
   * @param {string|djs.model.Base} [elementOrTemplateId]
   * @return {Array<ElementTemplate>}
   */
  getAll(elementOrTemplateId) {
    return findTemplates(elementOrTemplateId, this._templatesById, { includeDeprecated: true });
  }


  /**
   * Get all templates (with given ID or applicable to element) with the latest
   * version.
   *
   * @param {String|djs.model.Base} [elementOrTemplateId]
   * @param {{ deprecated?: boolean }} [options]
   *
   * @return {Array<ElementTemplate>}
   */
  getLatest(elementOrTemplateId, options = {}) {
    return findTemplates(elementOrTemplateId, this._templatesById, {
      ...options,
      latest: true
    });
  }

  /**
   * Get templates compatible with a given engine configuration override.
   *
   * @param {string|djs.model.Base} [elementOrTemplateId]
   * @param {Object} enginesOverrides
   * @param {Object} [options]
   * @param {boolean} [options.deprecated=false]
   * @param {boolean} [options.latest=true]
   *
   * @returns {Array<ElementTemplate>}
   */
  getCompatible(elementOrTemplateId, enginesOverrides = {}, options = {}) {
    const overridenEngines = this._coerceEngines({ ...this._engines, ...enginesOverrides });
    const templatesById = buildTemplatesById(this._templates, overridenEngines);

    return findTemplates(elementOrTemplateId, templatesById, {
      latest: true,
      ...options
    });
  }

  /**
   * Set templates.
   *
   * @param {Array<ElementTemplate>} templates
   */
  set(templates) {
    this._templates = templates;
    this._templatesById = buildTemplatesById(this._templates, this._engines);

    this._fire('changed');
  }

  getEngines() {
    return this._engines;
  }

  setEngines(engines) {
    this._engines = this._coerceEngines(engines);
    this._fire('engines.changed');
  }

  /**
   * Ensures that only valid engines are kept around
   *
   * @param { Record<string, string> } engines
   *
   * @return { Record<string, string> } filtered, valid engines
   */
  _coerceEngines(engines) {

    // we provide <elementTemplates> engine with the current
    // package version; templates may use that engine to declare
    // compatibility with this library
    engines = {
      elementTemplates: packageVersion,
      ...engines
    };

    return reduce(engines, (validEngines, version, engine) => {

      const coercedVersion = coerce(version);

      if (!isSemverValid(coercedVersion)) {
        console.error(
          new Error(`Engine <${ engine }> specifies unparseable version <${version}>`)
        );

        return validEngines;
      }

      return {
        ...validEngines,
        [ engine ]: coercedVersion.raw
      };
    }, {});
  }

  /**
   * Check if template is compatible with currently set engine version.
   *
   * @param {ElementTemplate} template
   *
   * @return {boolean} - true if compatible or no engine is set for elementTemplates or template.
   */
  isCompatible(template) {
    return _isCompatible(template, this._engines);
  }

  /**
   * Get engines that are incompatible with the template.
   *
   * @param {any} template
   *
   * @return { Record<string, { required: string, found: string } } - incompatible engines along with their template and local versions
   */
  getIncompatibleEngines(template) {
    return _getIncompatibleEngines(template, this._engines);
  }

  /**
   * Get template versions for a given element or template ID.
   *
   * @param {object|string|null} id
   * @param { { latest?: boolean, deprecated?: boolean } [options]
   *
   * @return {Array<ElementTemplate>}
   */
  _getTemplateVerions(id, options = {}) {
    return findTemplates(id, this._templatesById, options);
  }

  _getTemplateId(element) {
    return getTemplateId(element);
  }

  _getTemplateVersion(element) {
    return getTemplateVersion(element);
  }

  /**
   * Apply element template to a given element.
   *
   * @param {djs.model.Base} element
   * @param {ElementTemplate} newTemplate
   *
   * @return {djs.model.Base} the updated element
   */
  applyTemplate(element, newTemplate) {

    let action = 'apply';
    let payload = { element, newTemplate };
    const oldTemplate = this.get(element);

    if (oldTemplate && !newTemplate) {
      action = 'unlink';
      payload = { element };
    }

    if (newTemplate && oldTemplate && (newTemplate.id === oldTemplate.id)) {
      action = 'update';
    }

    const context = {
      element,
      newTemplate,
      oldTemplate
    };

    this._commandStack.execute('propertiesPanel.camunda.changeTemplate', context);

    this._fire(action, payload);

    return context.element;
  }

  _fire(action, payload) {
    return this._eventBus.fire(`elementTemplates.${action}`, payload);
  }

  /**
   * Remove template from a given element.
   *
   * @param {djs.model.Base} element
   *
   * @return {djs.model.Base} the updated element
   */
  removeTemplate(element) {
    this._fire('remove', { element });

    const context = {
      element
    };

    this._commandStack.execute('propertiesPanel.removeTemplate', context);

    return context.newElement;

  }

  /**
   * Unlink template from a given element.
   *
   * @param {djs.model.Base} element
   *
   * @return {djs.model.Base} the updated element
   */
  unlinkTemplate(element) {
    return this.applyTemplate(element, null);
  }

}

ElementTemplates.$inject = [
  'commandStack',
  'eventBus',
  'modeling',
  'injector',
  'config.elementTemplates'
];