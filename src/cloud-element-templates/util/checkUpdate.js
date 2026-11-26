import {
  getUpdateSteps,
  applyUpdateSteps,
  getBindingKey,
  isEditableProperty,
  isSameBinding
} from './updatePathsUtil';

import {
  findOldProperty,
  getDefaultFixedValue,
  isChoice,
  isUserInput,
  keepsValue
} from './carryOverUtil';

import { isConditionMet } from './conditionUtil';

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
 * Which values are carried over follows the rules the core applies. Changes in
 * what a value means to the implementation are not detected: no findings does
 * not mean the update is safe.
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
      ? property.choices.map(choice => choice.value).filter(value => isUserInput(value, property))
      : [ USER_INPUT ];

    for (const value of values) {
      findings.push(...checkValue(value, property, steps, oldTemplate, newTemplate));
    }
  }

  return deduplicate(findings);
}

function checkValue(value, property, steps, oldTemplate, newTemplate) {
  const { binding, label } = property;

  // moved values are written after the template is changed, so they win
  const moved = applyUpdateSteps(steps, other => isSameBinding(other, binding) ? value : undefined);

  const movedKeys = moved.map(({ binding }) => getBindingKey(binding));

  const continued = newTemplate.properties.filter(newProperty => {
    return !movedKeys.includes(getBindingKey(newProperty.binding)) &&
      findOldProperty({ properties: [ property ] }, newProperty);
  });

  const targets = [
    ...continued
      .filter(newProperty => keepsValue(value, property, newProperty))
      .map(newProperty => ({ property: newProperty, value })),
    ...moved.flatMap(({ binding, value }) => {
      return newTemplate.properties
        .filter(newProperty => isEditableProperty(newProperty, binding))
        .map(newProperty => ({ property: newProperty, value }));
    })
  ];

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

  if (!targets.length) {
    return [
      finding('drop', value === USER_INPUT && continued.some(newProperty => newProperty.type === 'Dropdown')
        ? 'is not carried over, unless it matches a choice'
        : 'is not carried over')
    ];
  }

  // the value is safe if one of the properties keeps it as is
  const issues = targets.map(({ property: target, value }) => {
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

  if (target.type === 'Dropdown' && !isChoice(target, value)) {
    return [ 'invalidate', value === USER_INPUT ? 'may not be a valid choice' : 'is not a valid choice' ];
  }

  if (value !== USER_INPUT) {
    return validateProperty(value, target) ? [ 'invalidate', 'becomes invalid' ] : null;
  }

  if (getKind(target) !== getKind(source) || target.feel !== source.feel) {
    return [ 'reinterpret', 'is interpreted differently' ];
  }

  return mayInvalidate(source, target) ? [ 'invalidate', 'may become invalid' ] : null;
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
      .filter(condition => {
        return isKnown(condition.property, template, oldTemplate) ||
          !isConditionMet({ condition }, template.properties, getDefaultFixedValue);
      })
      .map(({ type, property, ...condition }) => {
        const { binding } = findProperty(template, property) || {};

        return { ...condition, binding: binding ? getBindingKey(binding) : property };
      })
  );
}

function isKnown(id, template, oldTemplate) {
  const property = findProperty(template, id);

  return !property || oldTemplate.properties.some(other => isSameBinding(other.binding, property.binding));
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

function getPattern(pattern) {
  return pattern && (pattern.value || pattern);
}

function findProperty(template, id) {
  return template.properties.find(property => property.id === id);
}

function getName(property) {
  return property.label || JSON.stringify(property.binding);
}

function deduplicate(findings) {
  const seen = new Set();

  return findings.filter(({ message }) => !seen.has(message) && seen.add(message));
}
