import { isEventSubProcess } from 'bpmn-js/lib/util/DiUtil';
import { getPropertyValue } from './util/propertyUtil';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import {
  shouldCastToFeel,
  fromFeelExpression,
  isFeel
} from './util/FeelUtil';

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
  const { property: propertyId, equals, oneOf, isActive } = condition;

  if (typeof isActive !== 'undefined') {
    const relatedCondition = properties.find(p => p.id === propertyId);

    if (!relatedCondition) {
      return !isActive;
    }

    return isActive ? isConditionMet(element, properties, relatedCondition) : !isConditionMet(element, properties, relatedCondition);
  }

  const property = properties.find(p => p.id === propertyId);

  if (!property) {
    return false;
  }

  if (hasProperty(condition, 'equals')) {
    return compare(element, property, equals);
  }

  if (oneOf) {
    return oneOf.some(equals => compare(element, property, equals));
  }

  return false;
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

function compare(element, property, equals) {

  const value = shouldCastToFeel(property) ?
    fromFeelExpression(getPropertyValue(element, property), property.type) :
    getPropertyValue(element, property);

  if (typeof value === 'undefined' || value === null) {
    return false;
  }

  if (isFeel(equals)) {
    equals = fromFeelExpression(equals, property.type);
  }

  if (property.type === 'Number') {
    return Number(value) === Number(equals);
  }

  return value === equals;
}

// helpers //////////////////////

function hasProperty(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}