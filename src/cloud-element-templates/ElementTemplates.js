import {
  getTemplateId,
  getTemplateVersion
} from './Helper';

import { default as DefaultElementTemplates } from '../element-templates/ElementTemplates';

/**
 * @typedef {import('bpmn-js/lib/model/Types').Element} Element
 */

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
   * @param {Element} element
   * @param {ElementTemplate} newTemplate
   *
   * @return {Element} the updated element
   */
  applyTemplate(element, newTemplate) {
    const oldTemplate = this.get(element);

    const context = {
      element,
      newTemplate,
      oldTemplate
    };

    const event = oldTemplate?.id === newTemplate?.id ? 'update' : 'apply';

    this._commandStack.execute('propertiesPanel.zeebe.changeTemplate', context);

    this._fire(event, {
      element,
      newTemplate,
      oldTemplate
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

ElementTemplates.$inject = [
  'templateElementFactory',
  'commandStack',
  'eventBus',
  'modeling',
  'injector',
  'config.elementTemplates',
];
