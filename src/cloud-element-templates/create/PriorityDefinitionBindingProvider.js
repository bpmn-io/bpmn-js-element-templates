import {
  ensureExtension,
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export default class PriorityDefinitionBindingProvider {
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

    const priorityDefinition = ensureExtension(element, 'zeebe:PriorityDefinition', bpmnFactory);

    priorityDefinition.set(propertyName, value);
  }
}
