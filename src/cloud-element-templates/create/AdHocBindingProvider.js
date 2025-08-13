import { ensureExtension } from '../CreateHelper';
import { getDefaultValue } from '../Helper';

/**
 * Provider for the `zeebe:adHoc` binding. Ensures a single zeebe:AdHoc extension
 * element exists and sets the configured property on it.
 */
export default class AdHocBindingProvider {
  static create(element, options) {
    const { property, bpmnFactory } = options;

    const { binding } = property;
    const { property: propertyName } = binding;

    const value = getDefaultValue(property);

    const adHoc = ensureExtension(element, 'zeebe:AdHoc', bpmnFactory);

    adHoc.set(propertyName, value);
  }
}

