import {
  shouldCastToFeel,
  fromFeelExpression,
  isFeel
} from './FeelUtil';

/**
 * Check whether the condition of a property is met, reading values through
 * `getValue`. Pure, so the core and static checks share it.
 *
 * @param {Object} property
 * @param {Array<Object>} properties
 * @param {(property: Object) => any} getValue
 * @param {(property: Object) => boolean} [isAllowed]
 *
 * @returns {boolean}
 */
export function isConditionMet(property, properties, getValue, isAllowed = () => true) {

  if (!isAllowed(property)) {
    return false;
  }

  const { condition } = property;

  // If no condition is defined, return true.
  if (!condition) {
    return true;
  }

  // multiple ("and") conditions
  if (condition.allMatch) {
    const conditions = condition.allMatch;

    return conditions.every(
      condition => isSimpleConditionMet(condition, properties, getValue, isAllowed)
    );
  }

  // single condition
  return isSimpleConditionMet(condition, properties, getValue, isAllowed);
}

function isSimpleConditionMet(condition, properties, getValue, isAllowed) {
  const { property: propertyId, equals, oneOf, isActive, isEmpty } = condition;

  if (typeof isActive !== 'undefined') {
    const relatedProperty = properties.find(p => p.id === propertyId);

    if (!relatedProperty) {
      return !isActive;
    }

    const isRelatedActive = isConditionMet(relatedProperty, properties, getValue, isAllowed);

    return isActive ? isRelatedActive : !isRelatedActive;
  }

  const property = properties.find(p => p.id === propertyId);

  if (!property) {
    return false;
  }

  if (hasProperty(condition, 'isEmpty')) {
    const value = getValue(property);
    const isPropertyEmpty = value === undefined || value === null || value === '';
    return isEmpty ? isPropertyEmpty : !isPropertyEmpty;
  }

  if (hasProperty(condition, 'equals')) {
    return compare(getValue(property), property, equals);
  }

  if (oneOf) {
    return oneOf.some(equals => compare(getValue(property), property, equals));
  }

  return false;
}

function compare(value, property, equals) {

  if (shouldCastToFeel(property)) {
    value = fromFeelExpression(value, property.type);
  }

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
