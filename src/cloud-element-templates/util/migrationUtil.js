import { has, isString } from 'min-dash';

import { getPropertyValue } from './propertyUtil';
import { isFeel } from './FeelUtil';
import { isConditionMet } from '../Condition';

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
      const legacy = entries.find(step => !has(step, 'toVersion') && step.id === source.id);

      return legacy ? [ legacy ] : [];
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
    const writes = resolveMigrationProperties(read, [ { ...step, properties: step.properties || [] } ]);

    for (const { to, value } of writes) {
      staged.set(bindingKey(to), value);
    }

    return writes;
  });
}

function resolveMigrationProperties(read, properties) {
  return properties.flatMap(({ when, require: requirements, message, properties, from, to, set, values, replace, copyEmpty, includeHidden, required }) => {
    if (when && ![].concat(when).every(condition => matchesCondition(read, condition))) {
      return [];
    }

    if (requirements && ![].concat(requirements).every(condition => matchesCondition(read, condition))) {
      throw new Error(message || 'Migration requirement not met');
    }

    if (properties) {
      return resolveMigrationProperties(read, properties);
    }

    if (!from) {
      return [ { to, value: set, includeHidden, required } ];
    }

    let value = read(from);

    if (isEmpty(value)) {
      if (required && !copyEmpty) {
        throw new Error(`Required migration source is empty: ${ bindingKey(from) }`);
      }

      return copyEmpty ? [ { to, value: '', includeHidden, required } ] : [];
    }

    value = mapValue(value, values);

    if (replace) {
      if (!isString(value) || isFeel(value) || !isString(replace.pattern) || !isString(replace.replacement)) {
        throw new Error('Migration replacement requires a static string, pattern, and string replacement');
      }

      value = value.replace(new RegExp(replace.pattern), replace.replacement);
    }

    return [ { to, value, includeHidden, required } ];
  });
}

/**
 * Preflight authored requirements before entering the command stack.
 * Required conditional writes must follow explicit, stable controller writes.
 */
export function prepareMigration(element, source, target) {
  if (!source || !target) {
    return [];
  }

  const writes = resolveMigrationSteps(element, getMigrationSteps(target, source));
  const applied = new Map();
  let known;
  const read = (_, property) => {
    const key = bindingKey(property.binding);

    if (!applied.has(key) || !isConditionMet(element, target.properties, property, read)) {
      known = false;
    }

    const value = applied.get(key);

    return property.type === 'Boolean' && [ 'true', 'false' ].includes(value) ? value === 'true' : value;
  };

  for (const { to, value, includeHidden, required } of writes) {
    known = true;
    const property = findMigrationProperty(target.properties, to, includeHidden);
    const active = property && isConditionMet(element, target.properties, property, read);

    if (required && (!active || !known)) {
      throw new Error(`Required migration destination is missing, hidden, inactive, or lacks explicit controller writes: ${ bindingKey(to) }`);
    }

    if (active && known && (property.type !== 'Hidden' ||
        property.persist && [ 'zeebe:input', 'zeebe:output' ].includes(property.binding.type))) {
      applied.set(bindingKey(to), value);
    }

    for (const property of target.properties.filter(property => applied.has(bindingKey(property.binding)))) {
      known = true;
      if (!isConditionMet(element, target.properties, property, read) || !known) {
        applied.delete(bindingKey(property.binding));
      }
    }
  }

  return writes;
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

export function getValidationErrors(element, template) {
  const read = binding => getPropertyValue(element, { type: 'String', binding });

  return (template.validation || []).filter(({ when }) =>
    [].concat(when).every(condition => matchesCondition(read, condition))
  );
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
