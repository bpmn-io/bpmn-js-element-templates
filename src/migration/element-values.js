// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Reads every value off a BPMN element's extension tree, keyed by binding.
 */

import { findExtensionContainers } from './binding.js';
import { getModdleElement, getModdleList, getModdleNumber, getModdleString, isModdleElement } from './moddle.js';
const AD_HOC_PROPERTIES = [ 'activeElementsCollection', 'outputCollection', 'outputElement' ];

/**
 * The task definition `type` is deliberately excluded: it identifies the
 * connector and is set by the target template, never carried over.
 */
export function enumerateElementValues(extensionElements) {
  const containers = findExtensionContainers(extensionElements);
  const out = [];
  const push = (bindingType, key, value) => {
    if (key === undefined || value === undefined) {
      return;
    }
    out.push({
      bindingType,
      key,
      value,
      isFeel: value.startsWith('=')
    });
  };
  for (const p of getModdleList(containers.ioMapping, 'inputParameters')) {
    push('zeebe:input', getModdleString(p, 'target'), getModdleString(p, 'source'));
  }
  for (const p of getModdleList(containers.ioMapping, 'outputParameters')) {
    push('zeebe:output', getModdleString(p, 'source'), getModdleString(p, 'target'));
  }
  for (const h of getModdleList(containers.taskHeaders, 'values')) {
    push('zeebe:taskHeader', getModdleString(h, 'key'), getModdleString(h, 'value'));
  }
  for (const p of getModdleList(containers.zeebeProperties, 'properties')) {
    push('zeebe:property', getModdleString(p, 'name'), getModdleString(p, 'value'));
  }
  if (containers.taskDefinition) {
    const retries = getModdleString(containers.taskDefinition, 'retries') ?? stringifyNumber(getModdleNumber(containers.taskDefinition, 'retries'));
    push('zeebe:taskDefinition', 'retries', retries);
  }
  if (containers.agentDefinition) {
    push('zeebe:agentDefinition', 'agentType', getModdleString(containers.agentDefinition, 'agentType'));
  }
  if (containers.adHoc) {
    for (const name of AD_HOC_PROPERTIES) {
      push('zeebe:adHoc', name, getModdleString(containers.adHoc, name));
    }
  }
  return out;
}

/** Extension elements whose values `enumerateElementValues` does not read. */
const UNREAD_EXTENSIONS = {
  'zeebe:CalledElement': 'zeebe:calledElement',
  'zeebe:CalledDecision': 'zeebe:calledDecision',
  'zeebe:FormDefinition': 'zeebe:formDefinition',
  'zeebe:Script': 'zeebe:script'
};
const LINKED_RESOURCE_PROPERTIES = [ 'resourceId', 'resourceType', 'bindingType', 'versionTag' ];

/** Set, non-internal attributes of a moddle element. */
function setAttributes(element) {
  return Object.keys(element).filter(name => !name.startsWith('$') && [ 'string', 'boolean', 'number' ].includes(typeof element[name]));
}

/**
 * Bindings of populated values the engine does not read, derived from the
 * element alone. For a source template whose definition is unavailable.
 */
export function unreadBindings(businessObject) {
  const bindings = [];
  for (const extension of getModdleList(getExtensionElements(businessObject), 'values')) {
    const type = UNREAD_EXTENSIONS[extension.$type];
    if (type) {
      for (const property of setAttributes(extension)) {
        bindings.push({
          type,
          property
        });
      }
    }
    if (extension.$type === 'zeebe:LinkedResources') {
      for (const resource of getModdleList(extension, 'values')) {
        const linkedResourceId = getModdleString(resource, 'linkedResourceId');
        for (const property of LINKED_RESOURCE_PROPERTIES) {
          if (getModdleString(resource, property) !== undefined) {
            bindings.push({
              type: 'zeebe:linkedResource',
              linkedResourceId,
              property
            });
          }
        }
      }
    }
  }
  const definition = getModdleList(businessObject, 'eventDefinitions')[0];
  const reference = businessObject.get('messageRef') ?? definition?.get('messageRef');
  if (isModdleElement(reference)) {
    if (getModdleString(reference, 'name') !== undefined) {
      bindings.push({
        type: 'bpmn:Message#property',
        name: 'name'
      });
    }
    const subscription = getModdleList(getExtensionElements(reference), 'values').find(v => v.$type === 'zeebe:Subscription');
    if (subscription && getModdleString(subscription, 'correlationKey') !== undefined) {
      bindings.push({
        type: 'bpmn:Message#zeebe:subscription#property',
        name: 'correlationKey'
      });
    }
  }
  return bindings;
}
function stringifyNumber(value) {
  return value === undefined ? undefined : String(value);
}

/** The element's `extensionElements`, or `undefined` when it has none. */
export function getExtensionElements(businessObject) {
  return getModdleElement(businessObject, 'extensionElements');
}
