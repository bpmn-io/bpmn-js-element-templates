import {
  filter,
  find,
  flatten,
  has,
  isNil,
  isObject,
  isString,
  isUndefined,
  reduce,
  values
} from 'min-dash';

import {
  getTemplateId,
  getTemplateVersion
} from './Helper';

import { isAny } from 'bpmn-js/lib/util/ModelUtil';

import {
  valid as isSemverValid,
  satisfies as isSemverCompatible,
  coerce
} from 'semver';

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
   * Set templates.
   *
   * @param {Array<ElementTemplate>} templates
   */
  set(templates) {
    this._templatesById = {};
    this._templates = templates;

    templates.forEach((template) => {
      const id = template.id;
      const version = isUndefined(template.version) ? '_' : template.version;

      if (!this._templatesById[ id ]) {
        this._templatesById[ id ] = { };
      }

      this._templatesById[ id ][ version ] = template;

      const latest = this._templatesById[ id ].latest;

      if (this.isCompatible(template)) {
        if (!latest || isUndefined(latest.version) || latest.version < version) {
          this._templatesById[ id ].latest = template;
        }
      }
    });

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
    const localEngines = this._engines;
    const templateEngines = template.engines;

    for (const engine in templateEngines) {

      // we check compatibility against all locally provided
      // engines, hence computing the overlap here.

      if (!has(localEngines, engine)) {
        continue;
      }

      if (!isSemverCompatible(localEngines[engine], templateEngines[engine])) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {object|string|null} id
   * @param { { latest?: boolean, deprecated?: boolean } [options]
   *
   * @return {Array<ElementTemplate>}
   */
  _getTemplateVerions(id, options = {}) {

    const {
      latest: includeLatestOnly,
      deprecated: includeDeprecated
    } = options;

    const templatesById = this._templatesById;
    const getVersions = (template) => {
      const { latest, ...versions } = template;
      return includeLatestOnly ? (
        !includeDeprecated && (latest && latest.deprecated) ? [] : (latest ? [ latest ] : [])
      ) : values(versions) ;
    };

    if (isNil(id)) {
      return flatten(values(templatesById).map(getVersions));
    }

    if (isObject(id)) {
      const element = id;

      return filter(this._getTemplateVerions(null, options), function(template) {
        return isAny(element, template.appliesTo);
      }) || [];
    }

    if (isString(id)) {
      return templatesById[ id ] && getVersions(templatesById[ id ]);
    }

    throw new Error('argument must be of type {string|djs.model.Base|undefined}');
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