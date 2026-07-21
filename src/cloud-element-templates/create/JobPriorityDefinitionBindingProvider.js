import {
  ensureExtension,
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export default class JobPriorityDefinitionBindingProvider {
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

    const jobPriorityDefinition = ensureExtension(element, 'zeebe:JobPriorityDefinition', bpmnFactory);

    jobPriorityDefinition.set(propertyName, value);
  }
}
