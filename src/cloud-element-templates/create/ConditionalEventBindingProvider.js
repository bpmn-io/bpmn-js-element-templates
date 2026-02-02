import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { getDefaultValue, findConditionalEventDefinition } from '../Helper';
import { createElement } from '../../utils/ElementUtil';
import { ensureExtension } from '../CreateHelper';

/**
 * Provider for `bpmn:ConditionalEventDefinition#property`.
 * Handles condition expression binding.
 */
export class ConditionalEventDefinitionPropertyBindingProvider {
  static create(element, options) {
    const {
      bpmnFactory,
      property
    } = options;

    const {
      binding
    } = property;

    const {
      name
    } = binding;

    const value = getDefaultValue(property);

    const conditionalEventDefinition = ensureConditionalEventDefinition(element);

    const expression = createElement(
      'bpmn:FormalExpression',
      { body: value },
      conditionalEventDefinition,
      bpmnFactory
    );

    conditionalEventDefinition.set(name, expression);
  }
}

/**
 * Provider for `bpmn:ConditionalEventDefinition#zeebe:conditionalFilter#property` bindings.
 * Handles `variableNames` and `variableEvents` properties.
 */
export class ConditionalEventDefinitionZeebeConditionalFilterBindingProvider {
  static create(element, options) {
    const {
      bpmnFactory,
      property
    } = options;

    const {
      binding
    } = property;

    const {
      name
    } = binding;

    const value = getDefaultValue(property);

    const conditionalEventDefinition = ensureConditionalEventDefinition(element);

    const conditionalFilter = ensureExtension(conditionalEventDefinition, 'zeebe:ConditionalFilter', bpmnFactory);

    conditionalFilter.set(name, value);
  }
}

/**
 * Get or create `bpmn:ConditionalEventDefinition` on element.
 *
 * @param {ModdleElement} element
 * @returns {ModdleElement} conditionalEventDefinition
 */
function ensureConditionalEventDefinition(element) {
  const businessObject = getBusinessObject(element);

  let conditionalEventDefinition = findConditionalEventDefinition(businessObject);

  if (!conditionalEventDefinition) {
    conditionalEventDefinition = createElement(
      'bpmn:ConditionalEventDefinition',
      {},
      businessObject,
      this._bpmnFactory
    );
    businessObject.set('eventDefinitions', [ conditionalEventDefinition ]);
  }

  return conditionalEventDefinition;
}
