import { has } from 'min-dash';

/**
 * @typedef { {
 *   templateId?: string,
 *   beforeVersion?: number,
 *   message?: string,
 *   changes?: string,
 *   hints?: Array<UpdateHint>
 * } } UpdatePath
 *
 * @typedef { {
 *   from: Object,
 *   to: Object,
 *   values?: Record<string, any>
 * } } UpdateHint
 *
 * @typedef { {
 *   template: Object,
 *   path: UpdatePath
 * } } UpdateStep a path, and the template that declares it
 */

/**
 * Get the steps that change an element from a source template to a template,
 * in the order they apply.
 *
 * A template declares its paths as a log, oldest first. A path without
 * `templateId` is an update path: it applies to versions of the same template
 * below `beforeVersion`. A path with `templateId` is a migration path: it
 * applies to that source template, and is followed by the update paths
 * declared after it.
 *
 * A migration first updates the element along the source template's own
 * update paths, declared by its latest version.
 *
 * @param {Object} template
 * @param {Object} sourceTemplate
 * @param {Object} [latestSourceTemplate] latest version of the source template
 *
 * @return {Array<UpdateStep>}
 */
export function getUpdateSteps(template, sourceTemplate, latestSourceTemplate = sourceTemplate) {
  if (template.id === sourceTemplate.id) {
    return getVersionUpdateSteps(template, sourceTemplate.version);
  }

  const paths = template.updatePaths || [];

  const index = paths.findIndex(path => path.templateId === sourceTemplate.id);

  if (index === -1) {
    return [];
  }

  return [
    ...getVersionUpdateSteps(latestSourceTemplate, sourceTemplate.version),
    ...paths.slice(index)
      .filter((path, i) => !i || !path.templateId)
      .map(path => ({ template, path }))
  ];
}

function getVersionUpdateSteps(template, version = 0) {
  return (template.updatePaths || [])
    .filter(path => !path.templateId && version < path.beforeVersion)
    .map(path => ({ template, path }));
}

/**
 * Apply the hints of the given steps in order. Hints of a step read the values
 * before that step, so a step can read a binding it writes, e.g. to swap two
 * bindings. Each step reads the result of the previous ones, so consecutive
 * steps chain.
 *
 * @param {Array<UpdateStep>} steps
 * @param {(binding: Object) => any} read value of a binding on the element
 *
 * @return {Array<{ binding: Object, value: any }>} values to write, in order
 */
export function applyUpdateSteps(steps, read) {
  let values = new Map();

  for (const { path } of steps) {
    const before = values;

    const get = binding => {
      const key = getBindingKey(binding);

      return before.has(key) ? before.get(key).value : read(binding);
    };

    values = new Map(before);

    for (const { from, to, values: valueMap } of path.hints || []) {
      const value = get(from);

      if (value === undefined || value === '') {
        continue;
      }

      const key = getBindingKey(to);

      // later writes win, and are applied after earlier ones
      values.delete(key);
      values.set(key, { binding: to, value: mapValue(value, valueMap) });
    }
  }

  return [ ...values.values() ];
}

/**
 * Map a value as hinted. `*` maps values that are not listed.
 *
 * @param {any} value
 * @param {Object} [values]
 *
 * @return {any}
 */
export function mapValue(value, values) {
  if (!values) {
    return value;
  }

  if (has(values, value)) {
    return values[ value ];
  }

  if (has(values, '*')) {
    return values[ '*' ];
  }

  return value;
}

/**
 * Check whether a property is a non-Hidden property for a binding, i.e. one
 * that update paths write to.
 *
 * @param {Object} property
 * @param {Object} binding
 *
 * @return {boolean}
 */
export function isEditableProperty(property, binding) {
  return property.type !== 'Hidden' && isSameBinding(property.binding, binding);
}

export function isSameBinding(a, b) {
  const keys = new Set([ ...Object.keys(a), ...Object.keys(b) ]);

  return [ ...keys ].every(key => a[ key ] === b[ key ]);
}

export function getBindingKey(binding) {
  return JSON.stringify(Object.keys(binding).sort().map(key => [ key, binding[ key ] ]));
}
