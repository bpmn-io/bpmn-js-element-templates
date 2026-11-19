/**
 * Replace the given methods of a type with ones that throw, to make
 * explicit that they are not available in a viewer.
 *
 * @param {Function} Type
 * @param {string[]} methods
 */
export function disableMethods(Type, methods) {
  methods.forEach(method => {
    Type.prototype[ method ] = function() {
      throw new Error(`<elementTemplates#${ method }> is not available in a viewer`);
    };
  });
}
