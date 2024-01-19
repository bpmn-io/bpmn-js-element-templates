import { find, groupBy } from 'min-dash';
import { getPropertyValue, setPropertyValue, validateProperty } from '../../../util/propertyUtil';

export function propertyGetter(element, property) {
  return function getValue() {
    return getPropertyValue(element, property);
  };
}

export function propertySetter(bpmnFactory, commandStack, element, property) {
  return function setValue(value) {
    return setPropertyValue(bpmnFactory, commandStack, element, property, value);
  };
}

export function propertyValidator(translate, property) {
  return value => validateProperty(value, property, translate);
}

export function groupByGroupId(properties) {
  return groupBy(properties, 'group');
}

export function findCustomGroup(groups, id) {
  return find(groups, g => g.id === id);
}

/**
 * Is the given property executed by the engine?
 *
 * @param { { binding: { type: string } } } property
 * @return {boolean}
 */
export function isExternalProperty(property) {
  return [ 'zeebe:property', 'zeebe:taskHeader' ].includes(property.binding.type);
}
