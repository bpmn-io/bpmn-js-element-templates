import {
  ensureExtension
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export class CalledElementBindingProvider {
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

    const calledElement = ensureExtension(element, 'zeebe:CalledElement', bpmnFactory);

    // TODO(@barmac): remove if we decide to support propagation in templates
    ensureNoPropagation(calledElement);

    calledElement.set(propertyName, value);
  }
}

function ensureNoPropagation(calledElement) {
  calledElement.set('propagateAllChildVariables', false);
  calledElement.set('propagateAllParentVariables', false);
}
