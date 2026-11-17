import { has, isString } from 'min-dash';

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
export function mapValue(value, values) {
  if (values && isString(value) && has(values, value)) {
    return values[ value ];
  }

  return value;
}

/**
 * Find the non-Hidden property for a binding.
 *
 * @param {Array<Object>} properties
 * @param {Object} binding
 *
 * @return {Object|undefined}
 */
export function findEditableProperty(properties, binding) {
  return properties.find(property => {
    return property.type !== 'Hidden' && isSameBinding(property.binding, binding);
  });
}

function isSameBinding(a, b) {
  const keys = new Set([ ...Object.keys(a), ...Object.keys(b) ]);

  return [ ...keys ].every(key => a[ key ] === b[ key ]);
}
