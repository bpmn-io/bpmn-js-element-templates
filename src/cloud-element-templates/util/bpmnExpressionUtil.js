import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import { createElement } from '../../utils/ElementUtil';

const EXPRESSION_TYPES = [
  'bpmn:Expression',
  'bpmn:FormalExpression'
];

export function isExpression(element, propertyName) {
  const bo = getBusinessObject(element);

  const descriptor = bo.$descriptor.propertiesByName[propertyName];

  return descriptor && EXPRESSION_TYPES.includes(descriptor.type);
}

export function createExpression(value, parent, bpmnFactory) {
  const expression = createElement('bpmn:FormalExpression', { body: value }, parent, bpmnFactory);

  return expression;
}

export function getExpressionValue(element, propertyName) {
  const bo = getBusinessObject(element);
  const expression = bo.get(propertyName);

  return expression?.get('body') || undefined;
}
