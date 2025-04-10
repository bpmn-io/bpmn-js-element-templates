import {
  isFunction,
  isUndefined,
  isArray,
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
    const elementTemplates = this._elementTemplates,
          moddle = this._moddle;

    const validator = new Validator(moddle).addAll(templates);

    const errors = validator.getErrors(),
          validTemplates = validator.getValidTemplates();

    elementTemplates.set(validTemplates);

    if (errors.length) {
      this._templateErrors(errors);
    }
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