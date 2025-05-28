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

    calledDecision.set(propertyName, value);
  }
}