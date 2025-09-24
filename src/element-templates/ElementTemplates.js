import {
  find,
  isString,
  isUndefined,
  isArray
} from 'min-dash';

import {
  getTemplateId,
  getTemplateVersion,
  coerceEngines,
  getIncompatibleEngines,
  isCompatible,
  findTemplates,
  buildTemplatesById
} from './Helper';

import { gt as semver_gt } from 'semver';

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
   * @param {String|djs.model.Base} id
   * @param {number} [version]
   *
   * @return {ElementTemplate}
   */
  get(id, version) {
    const templates = this._templatesById;

    let element;

    if (isUndefined(id)) {
      return null;
    } else if (isString(id)) {

      if (isUndefined(version)) {
        version = '_';
      }

      if (templates[ id ] && templates[ id ][ version ]) {
        return templates[ id ][ version ];
      } else {
        return null;
      }
    } else {
      element = id;

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
   * @param {string|djs.model.Base} [id]
   * @return {Array<ElementTemplate>}
   */
  getAll(id) {
    return this._getTemplateVerions(id, { includeDeprecated: true });
  }


  /**
   * Get all templates (with given ID or applicable to element) with the latest
   * version.
   *
   * @param {String|djs.model.Base} [id]
   * @param {{ deprecated?: boolean }} [options]
   *
   * @return {Array<ElementTemplate>}
   */
  getLatest(id, options = {}) {
    return this._getTemplateVerions(id, {
      ...options,
      latest: true
    });
  }

  /**
   * Get templates that would become available after an engine upgrade.
   *
   * @param {string|djs.model.Base} [id]
   * @param {Object|Array<Object>} engineUpgrades Sequence of or single engine upgrade(s) to be applied. Lists should be provided in ascending order for predictable results. Return structure matches this parameter.
   * @param {Object} [options]
   * @param {boolean} [options.includeVersionUpgrades=false]
   *
   * @returns {Array<ElementTemplate>|Array<Array<ElementTemplate>>}
   */
  getUpgrades(id, engineUpgrades, options = {}) {
    const singleUpgrade = !isArray(engineUpgrades);
    const engineUpgradeSteps = singleUpgrade ? [ engineUpgrades ] : engineUpgrades;

    const results = [];
    let currentEngines = this._engines;

    // initialize accumulator with latest templates from the current engine state
    let latestVersionsAcc = Object.fromEntries(this.getLatest(id).map(template => [ template.id, template.version ]));

    for (const upgrade of engineUpgradeSteps) {
      const futureEngines = { ...currentEngines, ...upgrade };

      const isActualUpgrade = Object.keys(upgrade).some(engine => {
        const currentVersion = currentEngines[engine];
        const futureVersion = futureEngines[engine];
        return currentVersion && futureVersion && semver_gt(futureVersion, currentVersion);
      });

      if (!isActualUpgrade) {
        results.push([]);
        continue;
      }

      const futureEngineTemplatesIndex = buildTemplatesById(this._templates, futureEngines);
      const futureTemplates = findTemplates(id, futureEngineTemplatesIndex, { latest: true });

      const newTemplates = [];

      for (const futureTemplate of futureTemplates) {
        const latestVersion = latestVersionsAcc[futureTemplate.id];
        const isValidUpgrade = options.includeVersionUpgrades
          ? (futureTemplate.version > (latestVersion ?? 0))
          : (!latestVersion);

        // new template ID
        if (isValidUpgrade) {
          newTemplates.push(futureTemplate);
          latestVersionsAcc[futureTemplate.id] = futureTemplate.version;
          continue;
        }
      }

      results.push(newTemplates);
      currentEngines = futureEngines;
    }

    return singleUpgrade ? results[0] : results;
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
    return coerceEngines(engines, packageVersion);
  }

  /**
   * Check if template is compatible with currently set engine version.
   *
   * @param {ElementTemplate} template
   *
   * @return {boolean} - true if compatible or no engine is set for elementTemplates or template.
   */
  isCompatible(template) {
    return isCompatible(template, this._engines);
  }

  /**
   * Get engines that are incompatible with the template.
   *
   * @param {any} template
   *
   * @return { Record<string, { required: string, found: string } } - incompatible engines along with their template and local versions
   */
  getIncompatibleEngines(template) {
    return getIncompatibleEngines(template, this._engines);
  }

  /**
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