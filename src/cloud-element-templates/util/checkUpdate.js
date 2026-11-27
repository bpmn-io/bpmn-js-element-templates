import {
  getUpdateSteps,
  applyUpdateSteps,
  getBindingKey,
  isSameBinding
} from './updatePathsUtil';

import { validateProperty } from './validateProperty';

/**
 * @typedef { {
 *   type: 'drop' | 'invalidate' | 'reinterpret',
 *   binding: Object,
 *   label?: string,
 *   value?: string,
 *   message: string
 * } } UpdateFinding
 */

const USER_INPUT = Symbol('user input');

/**
 * Check which user input an element would lose when it changes from one
 * template to another, along the update paths the new template declares.
 *
 * Reports user input that is not carried over, or may not be (`drop`), that
 * may no longer be valid (`invalidate`), or that is interpreted differently, as
 * its FEEL mode or kind of value changes (`reinterpret`).
 *
 * Changes in what a value means to the implementation are not detected: no
 * findings does not mean the update is safe.
 *
 * @param {Object} oldTemplate
 * @param {Object} newTemplate
 *
 * @return {Array<UpdateFinding>}
 */
export function checkUpdate(oldTemplate, newTemplate) {
  const steps = getUpdateSteps(newTemplate, oldTemplate);

  const findings = [];

  for (const property of oldTemplate.properties) {
    if (property.type === 'Hidden') {
      continue;
    }

    const values = property.type === 'Dropdown'
      ? property.choices.map(choice => choice.value)
      : [ USER_INPUT ];

    for (const value of values) {
      findings.push(...checkValue(value, property, steps, oldTemplate, newTemplate));
    }
  }

  return deduplicate(findings);
}

function checkValue(value, property, steps, oldTemplate, newTemplate) {
  const { binding, label } = property;

  const moved = applyUpdateSteps(steps, other => isSameBinding(other, binding) ? value : undefined);

  const targets = [
    { binding, value },
    ...moved
  ].flatMap(({ binding, value }) => {
    return getEditableProperties(newTemplate, binding).map(property => ({ property, value }));
  });

  const kept = targets.filter(({ property, value }) => isValidChoice(property, value));

  const name = value === USER_INPUT
    ? getName(property)
    : `${ getName(property) } choice <${ value }>`;

  const finding = (type, message) => ({
    type,
    binding,
    label,
    ...(value !== USER_INPUT && { value }),
    message: `${ name } ${ message }`
  });

  if (!kept.length) {
    return [
      finding('drop', value === USER_INPUT && targets.length
        ? 'is not carried over, unless it matches a choice'
        : 'is not carried over')
    ];
  }

  // the value is safe if one of the properties keeps it as is
  const issues = kept.map(({ property: target, value }) => {
    return getIssue(property, target, value, oldTemplate, newTemplate);
  });

  if (issues.includes(null)) {
    return [];
  }

  return [ finding(...issues[0]) ];
}

function getIssue(source, target, value, oldTemplate, newTemplate) {
  if (
    getConditions(target, newTemplate, oldTemplate) !==
    getConditions(source, oldTemplate, oldTemplate)
  ) {
    return [ 'drop', 'may not be carried over, if its condition is not met' ];
  }

  if (value !== USER_INPUT) {
    return validateProperty(value, target) ? [ 'invalidate', 'becomes invalid' ] : null;
  }

  if (getKind(target) !== getKind(source) || target.feel !== source.feel) {
    return [ 'reinterpret', 'is interpreted differently' ];
  }

  return mayInvalidate(source, target) ? [ 'invalidate', 'may become invalid' ] : null;
}

function getEditableProperties(template, binding) {
  return template.properties.filter(property => {
    return property.type !== 'Hidden' && isSameBinding(property.binding, binding);
  });
}

function isValidChoice(property, value) {
  if (property.type !== 'Dropdown') {
    return true;
  }

  return value !== USER_INPUT && property.choices.some(choice => choice.value === value);
}

/**
 * Get the conditions of a property, comparable across templates: conditions
 * refer to properties by their binding. Conditions on properties that are new,
 * and met by their default value, are met on existing elements, too.
 */
function getConditions(property, template, oldTemplate) {
  const { condition } = property;

  const conditions = condition ? condition.allMatch || [ condition ] : [];

  return JSON.stringify(
    conditions
      .map(({ type, property, ...condition }) => {
        const { binding } = findProperty(template, property) || {};

        return { ...condition, binding: binding ? getBindingKey(binding) : property };
      })
      .filter(condition => {
        return oldTemplate.properties.some(property => getBindingKey(property.binding) === condition.binding) ||
          !isMetByDefault(condition, template);
      })
  );
}

function isMetByDefault(condition, template) {
  const property = template.properties.find(property => getBindingKey(property.binding) === condition.binding);

  const value = property && property.value;

  if ('isEmpty' in condition) {
    return condition.isEmpty === (value === undefined || value === '');
  }

  if ('equals' in condition) {
    return value === condition.equals;
  }

  return !!condition.oneOf && condition.oneOf.includes(value);
}

/**
 * Whether arbitrary input, valid for the source property, may be invalid for
 * the target property, as its constraints are stricter. A changed pattern may
 * be, and needs to be verified manually.
 */
function mayInvalidate(source, target) {
  const {
    notEmpty,
    minLength = 0,
    maxLength = Infinity,
    pattern
  } = source.constraints || {};

  const constraints = target.constraints || {};

  return (
    (constraints.notEmpty && !notEmpty) ||
    (constraints.minLength || 0) > minLength ||
    (constraints.maxLength || Infinity) < maxLength ||
    (constraints.pattern && getPattern(constraints.pattern) !== getPattern(pattern))
  );
}

/**
 * The kind of value a property stores: Boolean and Number values are not
 * strings.
 */
function getKind(property) {
  return [ 'Boolean', 'Number' ].includes(property.type) ? property.type : 'String';
}

function findProperty(template, id) {
  return template.properties.find(property => property.id === id);
}

function getPattern(pattern) {
  return pattern && (pattern.value || pattern);
}

function getName(property) {
  return property.label || JSON.stringify(property.binding);
}

function deduplicate(findings) {
  const seen = new Set();

  return findings.filter(({ message }) => !seen.has(message) && seen.add(message));
}
