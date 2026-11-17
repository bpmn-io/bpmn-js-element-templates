// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Typed accessors for the untyped moddle object graph. All reads narrow with
 * runtime guards, never type assertions.
 */

export function isModdleElement(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('get' in value)) {
    return false;
  }
  return typeof value.get === 'function';
}
export function getModdleString(element, name) {
  const value = element.get(name);
  return typeof value === 'string' ? value : undefined;
}
export function getModdleNumber(element, name) {
  const value = element.get(name);
  return typeof value === 'number' ? value : undefined;
}
export function getModdleElement(element, name) {
  const value = element.get(name);
  return isModdleElement(value) ? value : undefined;
}

/** A collection property as a list of moddle elements; empty when absent. */
export function getModdleList(element, name) {
  if (!element) {
    return [];
  }
  const value = element.get(name);
  return Array.isArray(value) ? value.filter(isModdleElement) : [];
}
