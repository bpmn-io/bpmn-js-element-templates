import {
  isFunction,
  isUndefined,
  isArray,
  isObject,
  isString,
  isNil
} from 'min-dash';

import { Validator } from './Validator';

/**
 * The guy responsible for template loading.
 *
 * Provide the actual templates via the `config.elementTemplates`.
 *
 * That configuration can either be an array of template
 * descriptors or a node style callback to retrieve
 * the templates asynchronously.
 *
 * @param {Array<TemplateDescriptor>|Function} config
 * @param {EventBus} eventBus
 * @param {ElementTemplates} elementTemplates
 * @param {Moddle} moddle
 */
export default class ElementTemplatesLoader {
  constructor(config, eventBus, elementTemplates, moddle) {
    this._loadTemplates;
    this._eventBus = eventBus;
    this._elementTemplates = elementTemplates;
    this._moddle = moddle;

    if (isArray(config) || isFunction(config)) {
      this._loadTemplates = config;
    }

    if (config && config.loadTemplates) {
      this._loadTemplates = config.loadTemplates;
    }

    eventBus.on('diagram.init', () => {
      this.reload();
    });
  }

  reload() {
    const loadTemplates = this._loadTemplates;

    // no templates specified
    if (isUndefined(loadTemplates)) {
      return;
    }

    // template loader function specified
    if (isFunction(loadTemplates)) {

      return loadTemplates((err, templates) => {

        if (err) {
          return this._templateErrors([ err ]);
        }

        this.setTemplates(templates);
      });
    }

    // templates array specified
    if (loadTemplates.length) {
      return this.setTemplates(loadTemplates);
    }
  }

  setTemplates(templates) {
    const elementTemplates = this._elementTemplates;

    const validator = this._createValidator().addAll(templates);

    // load all schema-valid templates, including ones that are incompatible
    // with the host engines: they may already be applied to elements and must
    // keep working. Incompatible templates are merely excluded from _selection_,
    // which happens later via the engine-aware `getLatest` / `getCompatible`
    // lookups.
    elementTemplates.set(validator.getValidTemplates());

    // report validation errors, but suppress them for templates that are
    // incompatible with the host engines: a template built for another
    // environment (e.g. a newer modeler) must not surface intrusive "invalid
    // template" errors for schema features this installation cannot understand.
    //
    // @see https://github.com/camunda/camunda-modeler/issues/6071
    const errors = validator.getErrors().filter(
      (error) => !this._isIncompatibleTemplateError(error)
    );

    if (errors.length) {
      this._templateErrors(errors);
    }
  }

  /**
   * Create the validator used to validate templates. Overridden by the cloud
   * loader to plug in the Camunda Cloud validator.
   *
   * @return {Validator}
   */
  _createValidator() {
    return new Validator(this._moddle);
  }

  /**
   * Check whether a validation error was produced by a template that is
   * incompatible with the host's configured engines and should therefore be
   * suppressed.
   *
   * @param {Error} error
   *
   * @return {boolean}
   */
  _isIncompatibleTemplateError(error) {
    return isEngineIncompatible(this._elementTemplates, error.template);
  }

  _templateErrors(errors) {
    this._elementTemplates._fire('errors', {
      errors: errors
    });
  }
}

ElementTemplatesLoader.$inject = [
  'config.elementTemplates',
  'eventBus',
  'elementTemplates',
  'moddle'
];


// helpers ///////////////////////////

/**
 * Check whether a template can be safely determined to be incompatible with
 * the host's configured engines.
 *
 * Only well-formed `engines` declarations (a plain object of string ranges) are
 * trusted; for anything malformed we return `false` so the template's errors are
 * still reported by the validator, rather than silently suppressed.
 *
 * @param {ElementTemplates} elementTemplates
 * @param {TemplateDescriptor} template
 *
 * @return {boolean}
 */
function isEngineIncompatible(elementTemplates, template) {
  if (!isObject(template) || !hasValidEngines(template)) {
    return false;
  }

  return !elementTemplates.isCompatible(template);
}

/**
 * Check whether a template's `engines` are well-formed, i.e. absent or a plain
 * object mapping engine names to string ranges.
 *
 * @param {TemplateDescriptor} template
 *
 * @return {boolean}
 */
function hasValidEngines(template) {
  const engines = template.engines;

  if (isNil(engines)) {
    return true;
  }

  if (!isObject(engines)) {
    return false;
  }

  return Object.values(engines).every(isString);
}