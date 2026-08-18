import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  PROPERTY_TYPE,
  ZEBBE_INPUT_TYPE,
  ZEEBE_OUTPUT_TYPE,
  ZEEBE_PROPERTY_TYPE,
  ZEEBE_TASK_DEFINITION_TYPE_TYPE,
  ZEEBE_TASK_DEFINITION,
  ZEEBE_TASK_HEADER_TYPE,
  MESSAGE_PROPERTY_TYPE,
  MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE,
  SIGNAL_PROPERTY_TYPE,
  TIMER_EVENT_DEFINITION_PROPERTY_TYPE,
  CONDITIONAL_EVENT_DEFINITION_PROPERTY,
  CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY,
  ZEEBE_CALLED_ELEMENT,
  ZEEBE_LINKED_RESOURCE_PROPERTY,
  ZEEBE_CALLED_DECISION,
  ZEEBE_FORM_DEFINITION,
  ZEEBE_SCRIPT_TASK,
  ZEEBE_ASSIGNMENT_DEFINITION,
  ZEEBE_PRIORITY_DEFINITION,
  ZEEBE_JOB_PRIORITY_DEFINITION,
  ZEEBE_AD_HOC,
  ZEEBE_AGENT_DEFINITION,
  ZEEBE_TASK_SCHEDULE,
  ZEEBE_EXECUTION_LISTENER,
  ZEEBE_TASK_LISTENER
} from './bindingTypes';

import {
  getTaskDefinitionPropertyName
} from './taskDefinition';

import {
  findConditionalEventDefinition,
  findExtension,
  findInputParameter,
  findMessage,
  findOutputParameter,
  findSignal,
  findTaskHeader,
  findTimerEventDefinition,
  findZeebeProperty,
  findZeebeSubscription
} from '../Helper';

/**
 * Resolve the businessObject-relative moddle property path targeted by a
 * template property's binding. The returned path uses the same convention
 * as `bpmnlint-plugin-camunda-compat` findings and the Zeebe properties
 * panel's entry id resolver (`EntryIdUtil#getZeebeEntryId`): string segments
 * are moddle `get()` calls, numeric segments index into the array returned
 * by the previous segment.
 *
 * @param {djs.model.Base} element
 * @param {Object} binding a template property's `binding`
 *
 * @return {(string|number)[]|null} the path, or `null` if the binding is
 * unsupported or does not (yet) resolve to a moddle location on the element
 */
export function getBindingPath(element, binding) {
  const businessObject = getBusinessObject(element);

  const { type } = binding;

  switch (type) {
  case PROPERTY_TYPE:
    return [ binding.name ];

  case ZEBBE_INPUT_TYPE:
  case ZEEBE_OUTPUT_TYPE:
    return getIoBindingPath(businessObject, binding, type);

  case ZEEBE_TASK_HEADER_TYPE:
    return getTaskHeaderBindingPath(businessObject, binding);

  case ZEEBE_PROPERTY_TYPE:
    return getZeebePropertyBindingPath(businessObject, binding);

  case ZEEBE_TASK_DEFINITION_TYPE_TYPE:
  case ZEEBE_TASK_DEFINITION:
    return getExtensionBindingPath(businessObject, 'zeebe:TaskDefinition', getTaskDefinitionPropertyName(binding));

  case MESSAGE_PROPERTY_TYPE:
    return getMessageBindingPath(businessObject, binding);

  case MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE:
    return getMessageSubscriptionBindingPath(businessObject, binding);

  case SIGNAL_PROPERTY_TYPE:
    return getSignalBindingPath(businessObject, binding);

  case ZEEBE_CALLED_ELEMENT:
    return getExtensionBindingPath(businessObject, 'zeebe:CalledElement', binding.property);

  case ZEEBE_CALLED_DECISION:
    return getExtensionBindingPath(businessObject, 'zeebe:CalledDecision', binding.property);

  case ZEEBE_FORM_DEFINITION:
    return getExtensionBindingPath(businessObject, 'zeebe:FormDefinition', binding.property);

  case ZEEBE_SCRIPT_TASK:
    return getExtensionBindingPath(businessObject, 'zeebe:Script', binding.property);

  case ZEEBE_ASSIGNMENT_DEFINITION:
    return getExtensionBindingPath(businessObject, 'zeebe:AssignmentDefinition', binding.property);

  case ZEEBE_TASK_SCHEDULE:
    return getExtensionBindingPath(businessObject, 'zeebe:TaskSchedule', binding.property);

  case ZEEBE_PRIORITY_DEFINITION:
    return getExtensionBindingPath(businessObject, 'zeebe:PriorityDefinition', binding.property);

  case ZEEBE_JOB_PRIORITY_DEFINITION:
    return getExtensionBindingPath(businessObject, 'zeebe:JobPriorityDefinition', binding.property);

  case ZEEBE_AD_HOC:
    return getExtensionBindingPath(businessObject, 'zeebe:AdHoc', binding.property);

  case ZEEBE_AGENT_DEFINITION:
    return getExtensionBindingPath(businessObject, 'zeebe:AgentDefinition', binding.property);

  case ZEEBE_LINKED_RESOURCE_PROPERTY:
    return getLinkedResourceBindingPath(businessObject, binding);

  case TIMER_EVENT_DEFINITION_PROPERTY_TYPE:
    return getTimerBindingPath(businessObject, binding);

  case ZEEBE_EXECUTION_LISTENER:
    return getListenerBindingPath(businessObject, binding, 'zeebe:ExecutionListeners');

  case ZEEBE_TASK_LISTENER:
    return getListenerBindingPath(businessObject, binding, 'zeebe:TaskListeners');

  case CONDITIONAL_EVENT_DEFINITION_PROPERTY:
    return getConditionalEventDefinitionBindingPath(businessObject, binding);

  case CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY:
    return getConditionalFilterBindingPath(businessObject, binding);

  // Not (yet) path-resolvable — the provider defers (returns null) so the
  // standard entry answers. Known gap: zeebe:userTask, a marker binding that
  // has no bound property and renders no entry to resolve to.
  default:
    return null;
  }
}


// helpers //////////////////

/**
 * Path to a singleton extension element's property, e.g.
 * `[ 'extensionElements', 'values', <index>, <field> ]`.
 */
function getExtensionBindingPath(businessObject, extensionType, field) {
  const extension = findExtension(businessObject, extensionType);

  if (!extension) {
    return null;
  }

  const extensionIndex = getExtensionIndex(businessObject, extension);

  return [ 'extensionElements', 'values', extensionIndex, field ];
}

/**
 * Path to the (first) timer event definition's expression property, e.g.
 * `[ 'eventDefinitions', <index>, 'timeDuration' ]`. Mirrors the leaf the Zeebe
 * resolver keys on (`bpmn:TimerEventDefinition#<timeCycle|timeDate|timeDuration>`).
 */
function getTimerBindingPath(businessObject, binding) {
  const timerEventDefinition = findTimerEventDefinition(businessObject);

  if (!timerEventDefinition) {
    return null;
  }

  const index = businessObject.get('eventDefinitions').indexOf(timerEventDefinition);

  return [ 'eventDefinitions', index, binding.name ];
}

/**
 * Path to a listener's `type` within its container's `listeners` collection,
 * e.g. `[ 'extensionElements', 'values', <index>, 'listeners', <index>, 'type' ]`.
 * The listener is matched by its `eventType`, mirroring `getListenerValue`.
 */
function getListenerBindingPath(businessObject, binding, containerType) {
  const container = findExtension(businessObject, containerType);

  if (!container) {
    return null;
  }

  const listeners = container.get('listeners');

  const index = listeners.findIndex(listener => listener.get('eventType') === binding.eventType);

  if (index === -1) {
    return null;
  }

  const extensionIndex = getExtensionIndex(businessObject, container);

  return [ 'extensionElements', 'values', extensionIndex, 'listeners', index, 'type' ];
}

function getIoBindingPath(businessObject, binding, type) {
  const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');

  if (!ioMapping) {
    return null;
  }

  const extensionIndex = getExtensionIndex(businessObject, ioMapping);

  if (type === ZEBBE_INPUT_TYPE) {
    const inputParameter = findInputParameter(ioMapping, binding);

    if (!inputParameter) {
      return null;
    }

    const index = ioMapping.get('inputParameters').indexOf(inputParameter);

    return [ 'extensionElements', 'values', extensionIndex, 'inputParameters', index, 'source' ];
  }

  // zeebe:output
  const outputParameter = findOutputParameter(ioMapping, binding);

  if (!outputParameter) {
    return null;
  }

  const index = ioMapping.get('outputParameters').indexOf(outputParameter);

  return [ 'extensionElements', 'values', extensionIndex, 'outputParameters', index, 'target' ];
}

function getTaskHeaderBindingPath(businessObject, binding) {
  const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders');

  if (!taskHeaders) {
    return null;
  }

  const extensionIndex = getExtensionIndex(businessObject, taskHeaders);

  const header = findTaskHeader(taskHeaders, binding);

  if (!header) {
    return null;
  }

  const index = taskHeaders.get('values').indexOf(header);

  return [ 'extensionElements', 'values', extensionIndex, 'values', index, 'value' ];
}

function getZeebePropertyBindingPath(businessObject, binding) {
  const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');

  if (!zeebeProperties) {
    return null;
  }

  const extensionIndex = getExtensionIndex(businessObject, zeebeProperties);

  const zeebeProperty = findZeebeProperty(zeebeProperties, binding);

  if (!zeebeProperty) {
    return null;
  }

  const index = zeebeProperties.get('properties').indexOf(zeebeProperty);

  return [ 'extensionElements', 'values', extensionIndex, 'properties', index, 'value' ];
}

function getLinkedResourceBindingPath(businessObject, binding) {
  const linkedResources = findExtension(businessObject, 'zeebe:LinkedResources');

  if (!linkedResources) {
    return null;
  }

  const extensionIndex = getExtensionIndex(businessObject, linkedResources);

  const values = linkedResources.get('values');
  const index = values.findIndex((value) => value.get('linkName') === binding.linkName);

  if (index === -1) {
    return null;
  }

  return [ 'extensionElements', 'values', extensionIndex, 'values', index, binding.property ];
}

/**
 * Path prefix to reach the element referenced by `refProperty`
 * (`messageRef` or `signalRef`), mirroring `findMessage`/`findSignal`:
 * events reference through their (first) event definition, other elements
 * (e.g. receive tasks) hold the reference directly. Only called once the
 * reference is known to exist (so an event has event definitions).
 */
function getReferencedElementPrefix(businessObject, refProperty) {
  if (is(businessObject, 'bpmn:Event')) {
    return [ 'eventDefinitions', 0, refProperty ];
  }

  return [ refProperty ];
}

function getMessageBindingPath(businessObject, binding) {
  const message = findMessage(businessObject);

  if (!message) {
    return null;
  }

  const prefix = getReferencedElementPrefix(businessObject, 'messageRef');

  return [ ...prefix, binding.name ];
}

function getMessageSubscriptionBindingPath(businessObject, binding) {
  const message = findMessage(businessObject);

  if (!message) {
    return null;
  }

  const subscription = findZeebeSubscription(message);

  if (!subscription) {
    return null;
  }

  const prefix = getReferencedElementPrefix(businessObject, 'messageRef');

  const extensionIndex = getExtensionIndex(message, subscription);

  return [ ...prefix, 'extensionElements', 'values', extensionIndex, binding.name ];
}

function getSignalBindingPath(businessObject, binding) {
  const signal = findSignal(businessObject);

  if (!signal) {
    return null;
  }

  const prefix = getReferencedElementPrefix(businessObject, 'signalRef');

  return [ ...prefix, binding.name ];
}

function getConditionalEventDefinitionBindingPath(businessObject, binding) {
  const conditionalEventDefinition = findConditionalEventDefinition(businessObject);

  if (!conditionalEventDefinition) {
    return null;
  }

  const eventDefinitions = businessObject.get('eventDefinitions');
  const index = eventDefinitions.indexOf(conditionalEventDefinition);

  return [ 'eventDefinitions', index, binding.name ];
}

function getConditionalFilterBindingPath(businessObject, binding) {
  const conditionalEventDefinition = findConditionalEventDefinition(businessObject);

  if (!conditionalEventDefinition) {
    return null;
  }

  const eventDefinitions = businessObject.get('eventDefinitions');
  const defIndex = eventDefinitions.indexOf(conditionalEventDefinition);

  const conditionalFilter = findExtension(conditionalEventDefinition, 'zeebe:ConditionalFilter');

  if (!conditionalFilter) {
    return null;
  }

  const extensionIndex = getExtensionIndex(conditionalEventDefinition, conditionalFilter);

  return [ 'eventDefinitions', defIndex, 'extensionElements', 'values', extensionIndex, binding.name ];
}

/**
 * Index of an extension within its owner's `extensionElements.values`.
 */
function getExtensionIndex(owner, extension) {
  return owner.get('extensionElements').get('values').indexOf(extension);
}
