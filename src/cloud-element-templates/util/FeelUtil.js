/**
 * Check if the property is cast to FEEL expression:
 * - Any property with feel set to 'required'
 * - Boolean and Number properties with feel set to 'optional' or 'static'
 * - Boolean and Number input/output parameters have default feel=static
 *
 * @returns {boolean}
 */
export const shouldCastToFeel = (property) => {
  const feel = getFeelValue(property);

  if (feel === 'required') {
    return true;
  }

  return [ 'optional', 'static' ].includes(feel) && [ 'Boolean', 'Number' ].includes(property.type);
};

const ALWAYS_CAST_TO_FEEL = [
  'zeebe:input',
  'zeebe:output'
];

function getFeelValue(property) {
  if (ALWAYS_CAST_TO_FEEL.includes(property.binding.type)) {
    return property.feel || 'static';
  }

  return property.feel;
}

export const toFeelExpression = (value, type) => {
  if (typeof value === 'string' && value.startsWith('=')) {
    return value;
  }

  if (type === 'Boolean') {
    value = value === 'false' ? false : value;
    return '=' + !!value;
  }

  if (typeof value === 'undefined') {
    return value;
  }

  return '=' + value.toString();
};

export const fromFeelExpression = (value, type) => {
  if (typeof value === 'undefined') {
    return value;
  }

  if (typeof value === 'string' && value.startsWith('=')) {
    value = value.slice(1);
  }

  if (type === 'Number') {
    return Number(value);
  }

  if (type === 'Boolean') {
    return value !== 'false';
  }

  return value;
};