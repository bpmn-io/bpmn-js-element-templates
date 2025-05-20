import {
  ensureExtension
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export class CalledDecisionBindingProvider {
  static create(element, options) {
    const {
      property,
      bpmnFactory
    } = options;

    const {
      binding
    } = property;

    const {
      property: propertyName
    } = binding;

    const value = getDefaultValue(property);

    const calledDecision = ensureExtension(element, 'zeebe:CalledDecision', bpmnFactory);

    // todo set all properties -> this seems to be done automatically? Each property is called here individually

    calledDecision.set(propertyName, value);
  }
}