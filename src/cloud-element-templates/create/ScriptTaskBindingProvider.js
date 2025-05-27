import {
  ensureExtension
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export class ScriptTaskBindingProvider {
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

    const scriptTask = ensureExtension(element, 'zeebe:Script', bpmnFactory);

    scriptTask.set(propertyName, value);
  }
}
