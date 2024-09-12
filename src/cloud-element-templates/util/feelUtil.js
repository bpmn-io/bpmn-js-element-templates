export const isSpecialFeelProperty = (property) => {
  return [ 'optional', 'static' ].includes(property.feel) && [ 'Boolean', 'Number' ].includes(property.type);
};

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