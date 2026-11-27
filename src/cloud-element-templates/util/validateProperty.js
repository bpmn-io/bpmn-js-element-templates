import { isString } from 'min-dash';

import { isFeel } from './FeelUtil';


// TODO(@barmac): fix translate usage (https://github.com/bpmn-io/bpmn-js-element-templates/pull/53#issuecomment-1906203270)
export function validateProperty(value, property, translate = defaultTranslate) {
  const {
    constraints = {},
    label
  } = property;

  const {
    maxLength,
    minLength,
    notEmpty
  } = constraints;

  if (notEmpty && isEmpty(value)) {
    return label
      ? translate('{label} must not be empty.', { label })
      : translate('Must not be empty.');
  }

  if (property.feel && isFeel(value)) {
    return;
  }

  if (maxLength && (value || '').length > maxLength) {
    return label
      ? translate('{label} cannot exceed {maxLength} characters.', { label, maxLength })
      : translate('Cannot exceed {maxLength} characters.', { maxLength });
  }

  if (minLength && (value || '').length < minLength) {
    return label
      ? translate('{label} must be at least {minLength} characters.', { label, minLength })
      : translate('Must be at least {minLength} characters.', { minLength });
  }

  let { pattern } = constraints;

  if (pattern) {
    let message;

    if (!isString(pattern)) {
      message = pattern.message;
      pattern = pattern.value;
    }

    if (!matchesPattern(value, pattern)) {
      if (message) {
        return label
          ? translate('{label} {message}', { label, message })
          : translate(message);
      }

      return label
        ? translate('{label} must match pattern {pattern}.', { label, pattern })
        : translate('Must match pattern {pattern}.', { pattern });
    }
  }
}


// helpers

function isEmpty(value) {
  if (typeof value === 'string') {
    return !value.trim().length;
  }

  return value === undefined;
}

function matchesPattern(string, pattern) {
  return new RegExp(pattern).test(string);
}

function defaultTranslate(template, replacements) {

  replacements = replacements || {};

  return template.replace(/{([^}]+)}/g, function(_, key) {
    return replacements[key] || '{' + key + '}';
  });
}
