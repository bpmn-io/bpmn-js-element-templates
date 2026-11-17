/**
 * Strict structural equality for JSON template definitions. Unlike JSON.stringify,
 * object member order does not matter. Keep missing and undefined members distinct
 * for templates constructed in JavaScript, too.
 */
export function isDeepStrictEqual(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (Array.isArray(a) && a.length !== b.length) return false;
  if (seen.has(a)) return seen.get(a) === b;
  const keys = Reflect.ownKeys(a).filter(key => Object.prototype.propertyIsEnumerable.call(a, key));
  const otherKeys = Reflect.ownKeys(b).filter(key => Object.prototype.propertyIsEnumerable.call(b, key));
  if (keys.length !== otherKeys.length) return false;
  seen.set(a, b);
  const equal = keys.every(key => Object.prototype.propertyIsEnumerable.call(b, key) && isDeepStrictEqual(a[key], b[key], seen));
  seen.delete(a);
  return equal;
}
