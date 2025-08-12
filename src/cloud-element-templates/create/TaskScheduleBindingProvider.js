import {
  ensureExtension,
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export default class TaskScheduleBindingProvider {
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

    const taskSchedule = ensureExtension(element, 'zeebe:TaskSchedule', bpmnFactory);

    taskSchedule.set(propertyName, value);
  }
}
