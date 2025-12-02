import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import { getDefaultValue, findTimerEventDefinition } from '../Helper';
import { createElement } from '../../utils/ElementUtil';

export class TimerPropertyBindingProvider {
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

    const businessObject = getBusinessObject(element);

    let timerEventDefinition = findTimerEventDefinition(businessObject);

    if (!timerEventDefinition) {
      timerEventDefinition = createElement('bpmn:TimerEventDefinition', {}, businessObject, bpmnFactory);
      businessObject.set('eventDefinitions', [ timerEventDefinition ]);
    }

    const expression = createElement('bpmn:FormalExpression', { body: value }, timerEventDefinition, bpmnFactory);

    timerEventDefinition.set(name, expression);

    if (name === 'timeCycle' && is(businessObject, 'bpmn:BoundaryEvent')) {
      businessObject.set('cancelActivity', false);
    }

  }
}
