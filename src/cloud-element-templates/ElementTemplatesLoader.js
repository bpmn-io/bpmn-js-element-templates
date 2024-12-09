import { Validator } from './Validator';

import { default as TemplatesLoader } from '../element-templates/ElementTemplatesLoader';

/**
 * @param {Object|Array<TemplateDescriptor>|Function} config
 * @param {EventBus} eventBus
 * @param {ElementTemplates} elementTemplates
 * @param {Moddle} moddle
 */
export default class ElementTemplatesLoader extends TemplatesLoader {
  constructor(config, eventBus, elementTemplates, moddle) {

    super(config, eventBus, elementTemplates, moddle);

    this._elementTemplates = elementTemplates;
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
}

ElementTemplatesLoader.$inject = [
  'config.elementTemplates',
  'eventBus',
  'elementTemplates',
  'moddle'
];