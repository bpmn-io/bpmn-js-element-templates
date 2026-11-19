import { has, isString } from 'min-dash';

import { getPropertyValue } from './propertyUtil';

/**
 * Get the ordered migration steps from the source to the target.
 *
 * @param {Object} template
 * @param {Object} source
 *
 * @return {Array<Object>}
 */
export function getMigrationSteps(template, source) {
  const entries = template.migratesFrom || [];
  const sourceVersion = source.version ?? 0;
  const targetVersion = template.version ?? 0;
  const sameId = template.id === source.id;
  const steps = entries
    .filter(step => Number.isInteger(step.toVersion) && step.toVersion > 0 && step.toVersion <= targetVersion)
    .sort((a, b) => a.toVersion - b.toVersion);

  const chain = [];
  let version = sourceVersion;

  if (!sameId) {
    const change = steps.find(step => step.sourceTemplateId === source.id && isEligible(step, version));

    if (!change) {
      return [];
    }

    chain.push(change);
    version = change.toVersion;
  }

  for (const step of steps) {
    if ((step.sourceTemplateId ?? template.id) === template.id &&
        step.toVersion > version && isEligible(step, version)) {
      chain.push(step);
      version = step.toVersion;
    }
  }

  return chain;
}

function isEligible(step, version) {
  return (step.minSourceVersion === undefined || version >= step.minSourceVersion) &&
    (step.maxSourceVersion === undefined || version <= step.maxSourceVersion);
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
export function resolveMigrationSteps(element, steps) {
  const staged = new Map();
  const read = binding => {
    const key = bindingKey(binding);

    return staged.has(key) ? staged.get(key) : getPropertyValue(element, { type: 'String', binding });
  };

  return steps.flatMap(step => {
    const writes = resolveMigrationInstructions(read, step.instructions || []);

    for (const { to, value } of writes) {
      staged.set(bindingKey(to), value);
    }

    return writes;
  });
}

function resolveMigrationInstructions(read, instructions) {
  return instructions.flatMap(({ when, instructions, from, to, set, values, replace }) => {
    if (when && ![].concat(when).every(condition => matchesCondition(read, condition))) {
      return [];
    }

    if (instructions) {
      return resolveMigrationInstructions(read, instructions);
    }

    if (!from) {
      return [ { to, value: set } ];
    }

    let value = read(from);

    if (isEmpty(value)) {
      return [];
    }

    value = mapValue(value, values);

    if (replace) {
      if (!isString(replace.pattern) || !isString(replace.replacement)) {
        throw new Error('Migration replacement requires a string pattern and replacement');
      }

      const pattern = new RegExp(replace.pattern);

      if (isString(value)) {
        value = value.replace(pattern, replace.replacement);
      }
    }

    return [ { to, value } ];
  });
}

export function prepareMigration(element, source, target) {
  if (!source || !target) {
    return [];
  }

  return resolveMigrationSteps(element, getMigrationSteps(target, source));
}

/**
 * Find the active, editable destination.
 *
 * @param {Array<Object>} properties
 * @param {Object} binding
 *
 * @return {Object|undefined}
 */
export function findMigrationProperty(properties, binding) {
  return properties.find(property => {
    return property.type !== 'Hidden' && isSameBinding(property.binding, binding);
  });
}

function matchesCondition(read, condition) {
  const { binding, equals, matches, not } = condition;
  const value = read(binding);

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

function bindingKey(binding) {
  return JSON.stringify(Object.keys(binding).sort().map(key => [ key, binding[key] ]));
}

function isEmpty(value) {
  return value == null || value === '';
}

function isSameBinding(a, b) {
  const keys = new Set([ ...Object.keys(a), ...Object.keys(b) ]);

  return [ ...keys ].every(key => a[ key ] === b[ key ]);
}
