import {
  getTemplateId,
  getTemplateVersion
} from './Helper';

import { default as DefaultElementTemplates } from '../element-templates/ElementTemplates';

/**
 * Registry for element templates.
 */
export default class ElementTemplates extends DefaultElementTemplates {
  constructor(templateElementFactory, commandStack, eventBus, modeling, injector, config) {
    super(commandStack, eventBus, modeling, injector, config);

    this._templateElementFactory = templateElementFactory;
  }

  _getTemplateId(element) {
    return getTemplateId(element);
  }

  _getTemplateVersion(element) {
    return getTemplateVersion(element);
  }

  /**
   * Create an element based on an element template. This is, for example,
   * called from the create-append anything menu.
   *
   * @param {ElementTemplate} template
   * @returns {djs.model.Base}
   */
  createElement(template) {
    if (!template) {
      throw new Error('template is missing');
    }

    const element = this._templateElementFactory.create(template);

    return element;
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

    this._commandStack.execute('propertiesPanel.zeebe.changeTemplate', context);

    this._eventBus.fire(`elementTemplates.${action}`, payload);

    return context.element;
  }

}

ElementTemplates.$inject = [
  'templateElementFactory',
  'commandStack',
  'eventBus',
  'modeling',
  'injector',
  'config.elementTemplates',
];
