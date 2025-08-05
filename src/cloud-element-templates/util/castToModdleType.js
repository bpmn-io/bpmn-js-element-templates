/**
 * Cast a value to the appropriate type for a moddle property.
 *
 * @param {Object} moddle - The moddle instance
 * @param {string} extensionType - The extension type (e.g., 'zeebe:PriorityDefinition')
 * @param {string} propertyName - The name of the property
 * @param {any} propertyValue - The value to cast
 * @returns {any} The cast value, or the original value if casting fails
 */
export function castToModdleType(moddle, extensionType, propertyName, propertyValue) {
  const originalPropertyValue = propertyValue;
  const desiredType = moddle.getTypeDescriptor(extensionType).properties.find(p => p.ns?.localName === propertyName)?.type;

  try {
    if (desiredType && desiredType === 'String') {
      return String(propertyValue);
    } else if (desiredType && desiredType === 'Integer') {
      return parseInt(propertyValue, 10);
    } else if (desiredType && desiredType === 'Boolean') {
      return Boolean(propertyValue);
    }
  } catch (e) {

    // this should likely never happen, but if it does, we log a warning
    console.warn(`Could not cast property value for ${propertyName} to ${desiredType}. Using original value. ${originalPropertyValue}`);
  }

  return propertyValue;
}

