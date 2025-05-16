import { createElement } from '../../utils/ElementUtil';

export function isExpression(element, propertyName) {
  const descriptor = element.$descriptor.propertiesByName[propertyName];

  return descriptor && descriptor.type === 'bpmn:Expression';
}

export function createExpression(value, parent, bpmnFactory) {
  const expression = createElement('bpmn:Expression', { body: value }, parent, bpmnFactory);

  return expression;
}

export function setExpressionValue(descriptor, value) {
}
