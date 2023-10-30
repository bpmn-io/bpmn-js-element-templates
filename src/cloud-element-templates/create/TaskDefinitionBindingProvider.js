import {
  ensureExtension
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';

import {
  getTaskDefinitionPropertyName
} from '../util/taskDefinition';


export default class TaskDefinitionTypeBindingProvider {
  static create(element, options) {
    const {
      property,
      bpmnFactory
    } = options;

    const value = getDefaultValue(property);
    const propertyName = getTaskDefinitionPropertyName(property.binding);

    const taskDefinition = ensureExtension(element, 'zeebe:TaskDefinition', bpmnFactory);
    taskDefinition.set(propertyName, value);
  }
}
