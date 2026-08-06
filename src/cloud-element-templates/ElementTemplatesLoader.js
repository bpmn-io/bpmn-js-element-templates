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

  setTemplates(templates) {
    const elementTemplates = this._elementTemplates;

    const validator = this._createValidator().addAll(templates);

    elementTemplates.set(validator.getValidTemplates());

    const errors = validator.getErrors().filter(
      (error) => !this._isIncompatibleTemplateError(error)
    );

    if (errors.length) {
      this._templateErrors(errors);
    }

    const warnings = validator.getWarnings();

    if (warnings.length) {
      elementTemplates._fire('warnings', { warnings });
    }
  }
}

ElementTemplatesLoader.$inject = [
  'config.elementTemplates',
  'eventBus',
  'elementTemplates',
  'moddle'
];