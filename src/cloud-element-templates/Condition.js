import { isEventSubProcess } from 'bpmn-js/lib/util/DiUtil';
import { getPropertyValue } from './util/propertyUtil';
import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import { isConditionMet as isConditionMetUtil } from './util/conditionUtil';

/**
 * Based on conditions, remove properties from the template.
 */
export function applyConditions(element, elementTemplate) {
  const { properties } = elementTemplate;

  const filteredProperties = properties.filter(property => {
    return isConditionMet(element, properties, property);
  });

  return {
    ...elementTemplate,
    properties: filteredProperties
  };
}

export function isConditionMet(element, properties, property) {
  return isConditionMetUtil(
    property,
    properties,
    property => getPropertyValue(element, property),
    property => isPropertyAllowed(element, property)
  );
}

function isPropertyAllowed(element, property) {
  const { binding } = property;
  const { type } = binding;

  if (
    type === 'bpmn:Message#zeebe:subscription#property' &&
    binding.name === 'correlationKey' &&
    is(element, 'bpmn:StartEvent') &&
    !isEventSubProcess(getBusinessObject(element).$parent)
  ) {
    return false;
  }

  return true;
}
