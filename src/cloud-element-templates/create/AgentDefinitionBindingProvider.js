import { ensureExtension } from '../CreateHelper';
import { getDefaultValue } from '../Helper';

/**
 * Provider for the `zeebe:agentDefinition` binding. Ensures a single
 * zeebe:AgentDefinition extension element exists and sets the configured
 * property on it.
 */
export default class AgentDefinitionBindingProvider {
  static create(element, options) {
    const { property, bpmnFactory } = options;

    const { binding } = property;
    const { property: propertyName } = binding;

    const value = getDefaultValue(property);

    const agentDefinition = ensureExtension(element, 'zeebe:AgentDefinition', bpmnFactory);

    agentDefinition.set(propertyName, value);
  }
}
