import {
  ensureExtension,
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export default class AssignmentDefinitionBindingProvider {
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

    const assignmentDefinition = ensureExtension(element, 'zeebe:AssignmentDefinition', bpmnFactory);

    assignmentDefinition.set(propertyName, value);
  }
}