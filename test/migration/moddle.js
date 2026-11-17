/**
 * Plain-object stand-ins for moddle elements, for engine unit tests.
 */

export function moddle($type, props) {
  return {
    $type,
    ...props,
    get: name => props[name]
  };
}
export function extensionElements(...values) {
  return moddle('bpmn:ExtensionElements', {
    values
  });
}
