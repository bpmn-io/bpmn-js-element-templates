export const PROPERTY_TYPE = 'property';

export const ZEBBE_PROPERTY_TYPE = 'zeebe:property';
export const ZEBBE_INPUT_TYPE = 'zeebe:input';
export const ZEEBE_OUTPUT_TYPE = 'zeebe:output';
export const ZEEBE_PROPERTY_TYPE = 'zeebe:property';
export const ZEEBE_TASK_DEFINITION_TYPE_TYPE = 'zeebe:taskDefinition:type';
export const ZEEBE_TASK_DEFINITION = 'zeebe:taskDefinition';
export const ZEEBE_TASK_HEADER_TYPE = 'zeebe:taskHeader';
export const MESSAGE_PROPERTY_TYPE = 'bpmn:Message#property';
export const MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE = 'bpmn:Message#zeebe:subscription#property';
export const SIGNAL_PROPERTY_TYPE = 'bpmn:Signal#property';
export const TIMER_EVENT_DEFINITION_PROPERTY_TYPE = 'bpmn:TimerEventDefinition#property';
export const ZEEBE_CALLED_ELEMENT = 'zeebe:calledElement';
export const ZEEBE_LINKED_RESOURCE_PROPERTY = 'zeebe:linkedResource';
export const ZEEBE_USER_TASK = 'zeebe:userTask';
export const ZEEBE_CALLED_DECISION = 'zeebe:calledDecision';
export const ZEEBE_FORM_DEFINITION = 'zeebe:formDefinition';
export const ZEEBE_SCRIPT_TASK = 'zeebe:script';
export const ZEEBE_ASSIGNMENT_DEFINITION = 'zeebe:assignmentDefinition';
export const ZEEBE_PRIORITY_DEFINITION = 'zeebe:priorityDefinition';
export const ZEEBE_AD_HOC = 'zeebe:adHoc';
export const ZEEBE_TASK_SCHEDULE = 'zeebe:taskSchedule';

export const EXTENSION_BINDING_TYPES = [
  MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE,
  ZEBBE_INPUT_TYPE,
  ZEEBE_OUTPUT_TYPE,
  ZEEBE_PROPERTY_TYPE,
  ZEEBE_TASK_DEFINITION_TYPE_TYPE,
  ZEEBE_TASK_DEFINITION,
  ZEEBE_TASK_HEADER_TYPE,
  ZEEBE_CALLED_ELEMENT,
  ZEEBE_LINKED_RESOURCE_PROPERTY,
  ZEEBE_CALLED_DECISION,
  ZEEBE_FORM_DEFINITION,
  ZEEBE_SCRIPT_TASK,
  ZEEBE_ASSIGNMENT_DEFINITION,
  ZEEBE_PRIORITY_DEFINITION,
  ZEEBE_AD_HOC,
  ZEEBE_TASK_SCHEDULE
];

export const TASK_DEFINITION_TYPES = [
  ZEEBE_TASK_DEFINITION_TYPE_TYPE,
  ZEEBE_TASK_DEFINITION
];

export const IO_BINDING_TYPES = [
  ZEBBE_INPUT_TYPE,
  ZEEBE_OUTPUT_TYPE
];

export const MESSAGE_BINDING_TYPES = [
  MESSAGE_PROPERTY_TYPE,
  MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE
];

export const PROPERTY_BINDING_TYPES = [
  PROPERTY_TYPE,
  MESSAGE_PROPERTY_TYPE,
  SIGNAL_PROPERTY_TYPE
];