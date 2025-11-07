import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import { getDefaultValue, getTemplateId } from '../Helper';

export class SignalPropertyBindingProvider {
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

    let businessObject = getBusinessObject(element);

    if (is(businessObject, 'bpmn:Event')) {
      businessObject = businessObject.get('eventDefinitions')[0];
    }

    let signal = businessObject.get('signalRef');

    if (!signal) {
      signal = bpmnFactory.create('bpmn:Signal', { 'zeebe:modelerTemplate': getTemplateId(element) });
      businessObject.set('signalRef', signal);
    }

    signal.set(name, value);
  }
}
