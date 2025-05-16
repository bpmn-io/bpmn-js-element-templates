import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import { getDefaultValue } from '../Helper';
import { isExpression, createExpression } from '../util/bpmnExpressionUtil';


export default class PropertyBindingProvider {
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

    let value = getDefaultValue(property);

    const businessObject = getBusinessObject(element);

    if (isExpression(businessObject, name)) {
      const expression = createExpression(value, businessObject, bpmnFactory);

      value = expression;
    }

    businessObject[name] = value;
  }
}