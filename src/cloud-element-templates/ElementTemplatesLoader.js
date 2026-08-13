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

  _createValidator() {
    return new Validator(this._moddle);
  }
}

ElementTemplatesLoader.$inject = [
  'config.elementTemplates',
  'eventBus',
  'elementTemplates',
  'moddle'
];