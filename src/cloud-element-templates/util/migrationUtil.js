import { has, isString } from 'min-dash';

import { getPropertyValue } from './propertyUtil';

/**
 * Get the migration a template declares for a source template.
 *
 * @param {Object} template
 * @param {string} sourceTemplateId
 *
 * @return {Object|undefined}
 */
export function getMigration(template, sourceTemplateId) {
  if (!sourceTemplateId || template.id === sourceTemplateId) {
    return;
  }

  return (template.migratesFrom || []).find(migration => migration.id === sourceTemplateId);
}

/**
 * Map a value as hinted by a migration.
 *
 * @param {any} value
 * @param {Object} [values]
 *
 * @return {any}
 */
function mapValue(value, values) {
  if (values && isString(value) && has(values, value)) {
    return values[ value ];
  }

  return value;
}

/**
 * Resolve instructions against the source before applying the new template.
 */
export function resolveMigrationProperties(element, properties) {
  return properties.flatMap(({ when, properties, from, to, set, values, copyEmpty, includeHidden }) => {
    if (when && ![].concat(when).every(condition => matchesCondition(element, condition))) {
      return [];
    }

    if (properties) {
      return resolveMigrationProperties(element, properties);
    }

    if (!from) {
      return [ { to, value: set, includeHidden } ];
    }

    const value = readValue(element, from);

    if (isEmpty(value)) {
      return copyEmpty ? [ { to, value: '', includeHidden } ] : [];
    }

    return [ { to, value: mapValue(value, values), includeHidden } ];
  });
}

/**
 * Find the active destination, allowing an explicit write to a hidden property.
 *
 * @param {Array<Object>} properties
 * @param {Object} binding
 * @param {boolean} [includeHidden]
 *
 * @return {Object|undefined}
 */
export function findMigrationProperty(properties, binding, includeHidden) {
  return properties.find(property => {
    return (includeHidden || property.type !== 'Hidden') && isSameBinding(property.binding, binding);
  });
}

function matchesCondition(element, condition) {
  const { binding, equals, matches, not } = condition;
  const value = readValue(element, binding);

  if (has(condition, 'isEmpty')) {
    return isEmpty(value) === condition.isEmpty;
  }

  if (has(condition, 'equals')) {
    return value === equals;
  }

  if (isString(matches)) {
    const matched = isString(value) && new RegExp(matches).test(value);

    return not ? !matched : matched;
  }

  return false;
}

function readValue(element, binding) {
  return getPropertyValue(element, { type: 'String', binding });
}

function isEmpty(value) {
  return value == null || value === '';
}

function isSameBinding(a, b) {
  const keys = new Set([ ...Object.keys(a), ...Object.keys(b) ]);

  return [ ...keys ].every(key => a[ key ] === b[ key ]);
}
