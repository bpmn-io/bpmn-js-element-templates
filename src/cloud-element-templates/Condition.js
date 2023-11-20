import { isEventSubProcess } from 'bpmn-js/lib/util/DiUtil';
import { getPropertyValue } from './util/propertyUtil';
import { is } from 'bpmn-js/lib/util/ModelUtil';

/**
 * Based on conditions, remove properties from the template.
 */
export function applyConditions(element, elementTemplate) {
  const { properties } = elementTemplate;

  const filteredProperties = properties.filter(property => {
    return isPropertyAllowed(element, property) && isConditionMet(element, properties, property);
  });

  return {
    ...elementTemplate,
    properties: filteredProperties
  };
}

export function isConditionMet(element, properties, property) {
  const { condition } = property;

  // If no condition is defined, return true.
  if (!condition) {
    return true;
  }

  // multiple ("and") conditions
  if (condition.allMatch) {
    const conditions = condition.allMatch;

    return conditions.every(
      condition => isSimpleConditionMet(element, properties, condition)
    );
  }

  // single condition
  return isSimpleConditionMet(element, properties, condition);
}

function isSimpleConditionMet(element, properties, condition) {
  const { property, equals, oneOf, isActive } = condition;

  if (typeof isActive !== 'undefined') {
    const relatedCondition = properties.find(p => p.id === property);

    if (!relatedCondition) {
      return !isActive;
    }

    return isActive ? isConditionMet(element, properties, relatedCondition) : !isConditionMet(element, properties, relatedCondition);
  }

  const propertyValue = getValue(element, properties, property);

  if (equals) {
    return propertyValue === equals;
  }

  if (oneOf) {
    return oneOf.includes(propertyValue);
  }

  return false;
}

export function getValue(element, properties, propertyId) {
  const property = properties.find(p => p.id === propertyId);

  if (!property) {
    return;
  }

  return getPropertyValue(element, property);
}

function isPropertyAllowed(element, property) {
  const { binding } = property;
  const { type } = binding;

  if (
    type === 'bpmn:Message#zeebe:subscription#property' &&
    binding.name === 'correlationKey' &&
    is(element, 'bpmn:StartEvent') &&
    !isEventSubProcess(element.parent)
  ) {
    return false;
  }

  return true;
}
