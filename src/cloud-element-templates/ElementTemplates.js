import {
  isObject
} from 'min-dash';

import {
  getTemplateId,
  getTemplateVersion
} from './Helper';

import { default as DefaultElementTemplates } from '../element-templates/ElementTemplates';

import { isTimerTemplateApplicable } from './util/timerUtil';

/**
 * @typedef {import('bpmn-js/lib/model/Types').Element} Element
 */

/**
 * Filters to determine whether a template is applicable to a given element.
 * @type {Array<(template: ElementTemplate, element: Element) => boolean>}
 */
const TEMPLATE_FILTERS = [
  isTimerTemplateApplicable
];

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
   * Get all templates (with given ID or applicable to element).
   *
   * @param {string|djs.model.Base} [elementOrTemplateId]
   * @return {Array<ElementTemplate>}
   */
  getAll(elementOrTemplateId) {
    const templates = super.getAll(elementOrTemplateId);

    if (isObject(elementOrTemplateId)) {
      return this._filterApplicableTemplates(templates, elementOrTemplateId);
    }

    return templates;
  }

  /**
   * Get all templates (with given ID or applicable to element) with the latest version.
   *
   * @param {String|djs.model.Base} [elementOrTemplateId]
   * @param {{ deprecated?: boolean }} [options]
   *
   * @return {Array<ElementTemplate>}
   */
  getLatest(elementOrTemplateId, options = {}) {
    const templates = super.getLatest(elementOrTemplateId, options);

    if (isObject(elementOrTemplateId)) {
      return this._filterApplicableTemplates(templates, elementOrTemplateId);
    }

    return templates;
  }

  /**
   * Get compatible templates for element with optional engine overrides.
   *
   * @param {String|djs.model.Base} [elementOrTemplateId]
   * @param {Object} [enginesOverrides]
   * @param {Object} [options]
   *
   * @return {Array<ElementTemplate>}
   */
  getCompatible(elementOrTemplateId, enginesOverrides = {}, options = {}) {
    const templates = super.getCompatible(elementOrTemplateId, enginesOverrides, options);

    if (isObject(elementOrTemplateId)) {
      return this._filterApplicableTemplates(templates, elementOrTemplateId);
    }

    return templates;
  }

  _filterApplicableTemplates(templates, element) {
    return TEMPLATE_FILTERS.reduce(
      (filteredTemplates, filterFn) =>
        filteredTemplates.filter(template => filterFn(template, element)),
      templates
    );
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
