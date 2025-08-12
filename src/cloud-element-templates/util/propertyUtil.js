import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  isString,
  isUndefined, without
} from 'min-dash';

import {
  EXTENSION_BINDING_TYPES,
  IO_BINDING_TYPES,
  MESSAGE_BINDING_TYPES,
  MESSAGE_PROPERTY_TYPE,
  MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE,
  PROPERTY_BINDING_TYPES,
  TASK_DEFINITION_TYPES,
  ZEEBE_TASK_DEFINITION_TYPE_TYPE,
  ZEEBE_TASK_DEFINITION,
  ZEBBE_INPUT_TYPE,
  ZEEBE_OUTPUT_TYPE,
  ZEEBE_PROPERTY_TYPE,
  ZEEBE_TASK_HEADER_TYPE,
  ZEEBE_CALLED_ELEMENT,
  ZEEBE_LINKED_RESOURCE_PROPERTY,
  ZEEBE_USER_TASK,
  ZEEBE_CALLED_DECISION,
  ZEEBE_FORM_DEFINITION,
  ZEEBE_SCRIPT_TASK,
  ZEEBE_ASSIGNMENT_DEFINITION,
  ZEEBE_PRIORITY_DEFINITION,
  ZEEBE_AD_HOC,
  ZEEBE_TASK_SCHEDULE
} from './bindingTypes';

import {
  getTaskDefinitionPropertyName
} from './taskDefinition';

import {
  findExtension,
  findTaskHeader,
  findInputParameter,
  findMessage,
  findOutputParameter,
  findZeebeProperty,
  findZeebeSubscription,
  getTemplateId
} from '../Helper';

import {
  createInputParameter,
  createOutputParameter,
  createTaskDefinition,
  createTaskHeader,
  createZeebeProperty,
  shouldUpdate
} from '../CreateHelper';

import { createElement } from '../../utils/ElementUtil';
import { getExpressionValue, isExpression, createExpression } from './bpmnExpressionUtil';

const EXPRESSION_TYPES = [
  'bpmn:Expression',
  'bpmn:FormalExpression'
];

export function getPropertyValue(element, property) {
  const rawValue = getRawPropertyValue(element, property);

  const { type } = property;

  if (type === 'Boolean') {
    return getBooleanPropertyValue(rawValue);
  }

  return rawValue;
}

function getRawPropertyValue(element, property) {
  let businessObject = getBusinessObject(element);

  const defaultValue = '';

  const {
    binding
  } = property;

  const {
    name,
    property: bindingProperty,
    type,
    linkName
  } = binding;

  // property
  if (type === 'property') {
    const value = isExpression(element, name) ? getExpressionValue(element, name) : businessObject.get(name);

    if (!isUndefined(value)) {
      return value;
    }

    return defaultValue;
  }

  // zeebe:taskDefinition
  if (TASK_DEFINITION_TYPES.includes(type)) {

    const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

    if (taskDefinition) {
      if (type === ZEEBE_TASK_DEFINITION_TYPE_TYPE) {
        return taskDefinition.get('type');
      } else if (type === ZEEBE_TASK_DEFINITION) {
        return taskDefinition.get(bindingProperty);
      }
    }

    return defaultValue;
  }

  if (IO_BINDING_TYPES.includes(type)) {
    const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');

    if (!ioMapping) {
      return defaultValue;
    }

    // zeebe:Input
    if (type === ZEBBE_INPUT_TYPE) {
      const inputParameter = findInputParameter(ioMapping, binding);

      if (inputParameter) {
        return inputParameter.get('source');
      }

      return defaultValue;
    }

    // zeebe:Output
    if (type === ZEEBE_OUTPUT_TYPE) {
      const outputParameter = findOutputParameter(ioMapping, binding);

      if (outputParameter) {
        return outputParameter.get('target');
      }

      return defaultValue;
    }
  }

  // zeebe:taskHeaders
  if (type === ZEEBE_TASK_HEADER_TYPE) {
    const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders');

    if (!taskHeaders) {
      return defaultValue;
    }

    const header = findTaskHeader(taskHeaders, binding);

    if (header) {
      return header.get('value');
    }

    return defaultValue;
  }

  // zeebe:Property
  if (type === ZEEBE_PROPERTY_TYPE) {
    const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');

    if (zeebeProperties) {
      const zeebeProperty = findZeebeProperty(zeebeProperties, binding);

      if (zeebeProperty) {
        return zeebeProperty.get('value');
      }
    }

    return defaultValue;
  }

  // bpmn:Message#property
  if (type === MESSAGE_PROPERTY_TYPE) {
    const message = findMessage(businessObject);

    const value = message ? message.get(name) : undefined;

    if (!isUndefined(value)) {
      return value;
    }

    return defaultValue;
  }

  // bpmn:Message#zeebe:subscription#property
  if (type === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE) {
    const message = findMessage(businessObject);

    if (message) {
      const subscription = findExtension(message, 'zeebe:Subscription');

      const value = subscription ? subscription.get(name) : undefined;

      if (!isUndefined(value)) {
        return subscription.get(name);
      }
    }

    return defaultValue;
  }

  // zeebe:calledElement
  if (type === ZEEBE_CALLED_ELEMENT) {
    const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

    return calledElement ? calledElement.get(bindingProperty) : defaultValue;
  }

  if (type === ZEEBE_LINKED_RESOURCE_PROPERTY) {
    const linkedResources = findExtension(businessObject, 'zeebe:LinkedResources');

    if (!linkedResources) {
      return defaultValue;
    }

    const linkedResource = linkedResources.get('values').find((value) => value.get('linkName') === linkName);

    return linkedResource ? linkedResource.get(bindingProperty) : defaultValue;
  }

  // zeebe:userTask
  if (type === ZEEBE_USER_TASK) {
    const userTask = findExtension(businessObject, 'zeebe:userTask');

    return userTask ? userTask.get(bindingProperty) : defaultValue;
  }

  // zeebe:calledDecision
  if (type === ZEEBE_CALLED_DECISION) {

    const calledDecision = findExtension(businessObject, 'zeebe:CalledDecision');

    return calledDecision ? calledDecision.get(bindingProperty) : defaultValue;
  }

  // zeebe:formDefinition
  if (type === ZEEBE_FORM_DEFINITION) {
    const formDefinition = findExtension(businessObject, 'zeebe:FormDefinition');

    return formDefinition ? formDefinition.get(bindingProperty) : defaultValue;
  }

  // zeebe:script
  if (type === ZEEBE_SCRIPT_TASK) {

    const scriptTask = findExtension(businessObject, 'zeebe:Script');

    return scriptTask ? scriptTask.get(bindingProperty) : defaultValue;
  }

  if (type === ZEEBE_ASSIGNMENT_DEFINITION) {
    const assignmentDefinition = findExtension(businessObject, 'zeebe:AssignmentDefinition');

    return assignmentDefinition ? assignmentDefinition.get(bindingProperty) : defaultValue;
  }

  if (type === ZEEBE_TASK_SCHEDULE) {
    const taskSchedule = findExtension(businessObject, 'zeebe:TaskSchedule');

    return taskSchedule ? taskSchedule.get(bindingProperty) : defaultValue;
  }

  if (type === ZEEBE_PRIORITY_DEFINITION) {
    const priorityDefinition = findExtension(businessObject, 'zeebe:PriorityDefinition');

    return priorityDefinition ? priorityDefinition.get(bindingProperty) : defaultValue;
  }

  if (type === ZEEBE_AD_HOC) {
    const adHoc = findExtension(businessObject, 'zeebe:AdHoc');
    return adHoc ? adHoc.get(bindingProperty) : defaultValue;
  }

  // should never throw as templates are validated beforehand
  throw unknownBindingError(element, property);
}

/**
 * Cast a string value to a boolean if possible. Otherwise return the value.
 * Cannot always cast due to FEEL expressions.
 *
 * @param {string|boolean} value
 */
function getBooleanPropertyValue(value) {
  switch (value) {
  case 'true':
    return true;
  case 'false':
    return false;
  }

  return value;
}

const NO_OP = null;

export function setPropertyValue(bpmnFactory, commandStack, element, property, value) {
  let businessObject = getBusinessObject(element);

  const {
    binding,
  } = property;

  const {
    name,
    type,
    property: bindingProperty,
    linkName
  } = binding;

  let extensionElements;

  let propertyValue;

  const commands = [];

  const context = {
    element,
    property
  };

  // ensure message exists
  if (MESSAGE_BINDING_TYPES.includes(type)) {
    if (is(businessObject, 'bpmn:Event')) {
      businessObject = businessObject.get('eventDefinitions')[0];
    }

    let message = findMessage(businessObject);

    if (!message) {
      message = bpmnFactory.create('bpmn:Message', { 'zeebe:modelerTemplate': getTemplateId(element) });

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: businessObject,
          properties: { messageRef: message }
        }
      });
    }

    businessObject = message;
  }

  // ensure extension elements
  if (EXTENSION_BINDING_TYPES.includes(type)) {
    extensionElements = businessObject.get('extensionElements');

    if (!extensionElements) {
      extensionElements = createElement('bpmn:ExtensionElements', null, businessObject, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: businessObject,
          properties: { extensionElements }
        }
      });
    } else {
      commands.push(NO_OP);
    }
  }

  // property
  if (PROPERTY_BINDING_TYPES.includes(type)) {

    const propertyType = businessObject.$descriptor.propertiesByName[ name ]?.type;
    let propertyName = name;

    if (!propertyType || propertyType === 'String') {

      // make sure we create and don't remove the property
      propertyValue = value || '';
    } else if (propertyType === 'Boolean') {
      propertyValue = !!value;
    } else if (propertyType === 'Integer') {
      propertyValue = parseInt(value, 10);

      if (isNaN(propertyValue)) {

        // do not set NaN value
        propertyValue = undefined;
      }
    } else if (EXPRESSION_TYPES.includes(propertyType)) {
      const existingExpression = businessObject.get(name);

      if (existingExpression && is(existingExpression, 'bpmn:FormalExpression')) {

        // re-use existing expression
        businessObject = existingExpression;
        propertyName = 'body';
        propertyValue = value || '';
      } else {
        propertyValue = createExpression(value, businessObject, bpmnFactory);
      }
    } else {

      // unsupported non-primitive types cannot be set
      throw new Error(`cannot set property of type <${ propertyType }>`);
    }

    if (!isUndefined(propertyValue)) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: businessObject,
          properties: { [ propertyName ]: propertyValue }
        }
      });
    } else {
      commands.push(NO_OP);
    }
  }

  // zeebe:taskDefinition
  if (TASK_DEFINITION_TYPES.includes(type)) {
    const oldTaskDefinition = findExtension(extensionElements, 'zeebe:TaskDefinition'),
          propertyName = getTaskDefinitionPropertyName(binding),
          properties = {
            [ propertyName ]: value || ''
          };

    if (oldTaskDefinition) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          properties,
          moddleElement: oldTaskDefinition
        }
      });
    } else {
      const newTaskDefinition = createTaskDefinition(properties, bpmnFactory);
      newTaskDefinition.$parent = businessObject;

      const values = extensionElements.get('values');

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...values, newTaskDefinition ] }
        }
      });
    }
  }

  if (IO_BINDING_TYPES.includes(type)) {
    let ioMapping = findExtension(extensionElements, 'zeebe:IoMapping');

    if (!ioMapping) {
      ioMapping = createElement('zeebe:IoMapping', null, businessObject, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), ioMapping ] }
        }
      });
    }

    // zeebe:Input
    if (type === ZEBBE_INPUT_TYPE) {
      const oldZeebeInputParameter = findInputParameter(ioMapping, binding);
      const values = ioMapping.get('inputParameters').filter((value) => value !== oldZeebeInputParameter);

      // do not persist empty parameters when configured as <optional>
      if (shouldUpdate(value, property)) {
        const newZeebeInputParameter = createInputParameter(binding, value, bpmnFactory);
        values.push(newZeebeInputParameter);
      }

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: ioMapping,
          properties: { inputParameters: [ ...values ] }
        }
      });
    }

    // zeebe:Output
    if (type === ZEEBE_OUTPUT_TYPE) {
      const oldZeebeOutputParameter = findOutputParameter(ioMapping, binding);
      const values = ioMapping.get('outputParameters').filter((value) => value !== oldZeebeOutputParameter);

      // do not persist empty parameters when configured as <optional>
      if (shouldUpdate(value, property)) {
        const newZeebeOutputParameter = createOutputParameter(binding, value, bpmnFactory);
        values.push(newZeebeOutputParameter);
      }

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: ioMapping,
          properties: { 'outputParameters': [ ...values ] }
        }
      });
    }
  }

  // zeebe:taskHeaders
  if (type === ZEEBE_TASK_HEADER_TYPE) {
    let taskHeaders = findExtension(extensionElements, 'zeebe:TaskHeaders');

    if (!taskHeaders) {
      taskHeaders = createElement('zeebe:TaskHeaders', null, businessObject, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), taskHeaders ] }
        }
      });
    }

    const oldTaskHeader = findTaskHeader(taskHeaders, binding);

    const values = taskHeaders.get('values').filter((value) => value !== oldTaskHeader);

    // do not persist task headers with empty value
    if (!value) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: taskHeaders,
          properties: { values }
        }
      });
    } else {
      const newTaskHeader = createTaskHeader(binding, value, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: taskHeaders,
          properties: { values: [ ...values, newTaskHeader ] }
        }
      });
    }
  }

  // zeebe:Property
  if (type === ZEEBE_PROPERTY_TYPE) {
    let zeebeProperties = findExtension(extensionElements, 'zeebe:Properties');

    if (!zeebeProperties) {
      zeebeProperties = createElement('zeebe:Properties', null, businessObject, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: extensionElements,
          properties: {
            values: [ ...extensionElements.get('values'), zeebeProperties ]
          }
        }
      });
    }

    const oldZeebeProperty = findZeebeProperty(zeebeProperties, binding);

    const properties = zeebeProperties.get('properties').filter((property) => property !== oldZeebeProperty);

    if (shouldUpdate(value, property)) {
      const newZeebeProperty = createZeebeProperty(binding, value, bpmnFactory);

      properties.push(newZeebeProperty);
    }

    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        element,
        moddleElement: zeebeProperties,
        properties: {
          properties
        }
      }
    });
  }

  // bpmn:Message#zeebe:subscription#property
  if (type === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE) {
    let subscription = findExtension(extensionElements, 'zeebe:Subscription');
    const properties = {
      [ name ]: value || ''
    };

    if (subscription) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: subscription
        }
      });
    } else {
      subscription = createElement('zeebe:Subscription', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), subscription ] }
        }
      });
    }
  }

  // zeebe:calledElement
  if (type === ZEEBE_CALLED_ELEMENT) {
    let calledElement = findExtension(element, 'zeebe:CalledElement');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (calledElement) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: calledElement
        }
      });
    } else {
      calledElement = createElement('zeebe:CalledElement', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), calledElement ] }
        }
      });
    }
  }

  // zeebe:linkedResource
  if (type === ZEEBE_LINKED_RESOURCE_PROPERTY) {
    let linkedResources = findExtension(businessObject, 'zeebe:LinkedResources');

    if (!linkedResources) {
      linkedResources = createElement('zeebe:LinkedResources', null, businessObject, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), linkedResources ] }
        }
      });
    }

    let linkedResource = linkedResources.get('values').find((value) => value.get('linkName') === linkName);

    if (!linkedResource) {
      linkedResource = createElement('zeebe:LinkedResource', { linkName }, businessObject, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: linkedResources,
          properties: { values: [ ...linkedResources.get('values'), linkedResource ] }
        }
      });
    }

    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        ...context,
        moddleElement: linkedResource,
        properties: { [ bindingProperty ]: value }
      }
    });
  }

  // zeebe:calledDecision
  if (type === ZEEBE_CALLED_DECISION) {
    let calledDecision = findExtension(element, 'zeebe:CalledDecision');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (calledDecision) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: calledDecision
        }
      });
    } else {
      calledDecision = createElement('zeebe:CalledDecision', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), calledDecision ] }
        }
      });
    }
  }

  // zeebe:script
  if (type === ZEEBE_SCRIPT_TASK) {
    let scriptTask = findExtension(element, 'zeebe:Script');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (scriptTask) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: scriptTask
        }
      });
    } else {
      scriptTask = createElement('zeebe:Script', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), scriptTask ] }
        }
      });
    }
  }

  // zeebe:formDefinition
  if (type === ZEEBE_FORM_DEFINITION) {
    let formDefinition = findExtension(element, 'zeebe:FormDefinition');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (formDefinition) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: formDefinition
        }
      });
    } else {
      formDefinition = createElement('zeebe:FormDefinition', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), formDefinition ] }
        }
      });
    }
  }

  // zeebe:assignmentDefinition
  if (type === ZEEBE_ASSIGNMENT_DEFINITION) {
    let assignmentDefinition = findExtension(element, 'zeebe:AssignmentDefinition');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (assignmentDefinition) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: assignmentDefinition
        }
      });
    } else {
      assignmentDefinition = createElement('zeebe:AssignmentDefinition', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), assignmentDefinition ] }
        }
      });
    }
  }

  // zeebe:taskSchedule
  if (type === ZEEBE_TASK_SCHEDULE) {
    let taskSchedule = findExtension(element, 'zeebe:TaskSchedule');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (taskSchedule) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: taskSchedule
        }
      });
    } else {
      taskSchedule = createElement('zeebe:TaskSchedule', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), taskSchedule ] }
        }
      });
    }
  }

  // zeebe:priorityDefinition
  if (type === ZEEBE_PRIORITY_DEFINITION) {
    let priorityDefinition = findExtension(element, 'zeebe:PriorityDefinition');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (priorityDefinition) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: priorityDefinition
        }
      });
    } else {
      priorityDefinition = createElement('zeebe:PriorityDefinition', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), priorityDefinition ] }
        }
      });
    }
  }

  // zeebe:adHoc
  if (type === ZEEBE_AD_HOC) {
    let adHoc = findExtension(element, 'zeebe:AdHoc');
    const propertyName = binding.property;

    const properties = {
      [ propertyName ]: value || ''
    };

    if (adHoc) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          properties,
          moddleElement: adHoc
        }
      });
    } else {
      adHoc = createElement('zeebe:AdHoc', properties, extensionElements, bpmnFactory);

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: { values: [ ...extensionElements.get('values'), adHoc ] }
        }
      });
    }
  }



  if (commands.length) {
    const commandsToExecute = commands.filter((command) => command !== NO_OP);

    commandsToExecute.length && commandStack.execute(
      'element-templates.multi-command-executor',
      commandsToExecute
    );

    return;
  }

  // should never throw as templates are validated beforehand
  throw unknownBindingError(element, property);
}


export function unsetProperty(commandStack, element, property) {
  let businessObject = getBusinessObject(element);

  const {
    binding
  } = property;

  const {
    type
  } = binding;

  let extensionElements;

  const commands = [];

  const context = {
    element,
    property
  };

  if (MESSAGE_BINDING_TYPES.includes(type)) {
    businessObject = findMessage(businessObject);

    if (!businessObject) {
      return;
    }
  }

  // property
  if (PROPERTY_BINDING_TYPES.includes(type)) {
    const { name } = binding;

    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        ...context,
        moddleElement: businessObject,
        properties: { [ name ]: undefined }
      }
    });
  }


  if (EXTENSION_BINDING_TYPES.includes(type)) {
    extensionElements = businessObject.get('extensionElements');
    if (!extensionElements)
      return;
  }

  // zeebe:taskDefinition
  if (TASK_DEFINITION_TYPES.includes(type)) {
    const oldTaskDefinition = findExtension(extensionElements, 'zeebe:TaskDefinition');

    const propertyName = getTaskDefinitionPropertyName(binding);

    if (oldTaskDefinition) {

      if (isOnlyProperty(oldTaskDefinition, propertyName)) {

        // remove task definition
        commands.push({
          cmd: 'element.updateModdleProperties',
          context: {
            ...context,
            moddleElement: extensionElements,
            properties: {
              values: without(extensionElements.get('values'), oldTaskDefinition)
            }
          }
        });
      } else {

        // remove property
        commands.push({
          cmd: 'element.updateModdleProperties',
          context: {
            ...context,
            moddleElement: oldTaskDefinition,
            properties: {
              [ propertyName ]: undefined
            }
          }
        });
      }
    }
  }


  // zeebe:IoMapping
  if (IO_BINDING_TYPES.includes(type)) {
    let ioMapping = findExtension(extensionElements, 'zeebe:IoMapping');

    if (!ioMapping)
      return;

    // zeebe:Input
    if (type === ZEBBE_INPUT_TYPE) {
      const oldZeebeInputParameter = findInputParameter(ioMapping, binding);
      const values = ioMapping.get('inputParameters').filter((value) => value !== oldZeebeInputParameter);

      if (ioMapping.get('outputParameters').length == 0 && values.length == 0) {

        commands.push({
          cmd: 'element.updateModdleProperties',
          context: {
            ...context,
            moddleElement: extensionElements,
            properties: {
              values:  without(extensionElements.get('values'), ioMapping)
            }
          }
        });
      }

      else {
        commands.push({
          cmd: 'element.updateModdleProperties',
          context: {
            ...context,
            moddleElement: ioMapping,
            properties: { inputParameters: [ ...values ] }
          }
        });
      }
    }

    // zeebe:Output
    if (type === ZEEBE_OUTPUT_TYPE) {
      const oldZeebeOutputParameter = findOutputParameter(ioMapping, binding);
      const values = ioMapping.get('outputParameters').filter((value) => value !== oldZeebeOutputParameter);

      if (ioMapping.get('inputParameters').length == 0 && values.length == 0) {

        commands.push({
          cmd: 'element.updateModdleProperties',
          context: {
            ...context,
            moddleElement: extensionElements,
            properties: {
              values: without(extensionElements.get('values'), ioMapping)
            }
          }
        });
      }

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: ioMapping,
          properties: { 'outputParameters': [ ...values ] }
        }
      });
    }
  }

  // zeebe:taskHeaders
  if (type === ZEEBE_TASK_HEADER_TYPE) {
    let taskHeaders = findExtension(extensionElements, 'zeebe:TaskHeaders');

    if (!taskHeaders)
      return;

    const oldTaskHeader = findTaskHeader(taskHeaders, binding);

    const values = taskHeaders.get('values').filter((value) => value !== oldTaskHeader);

    if (values.length === 0) {

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: {
            values: without(extensionElements.get('values'), taskHeaders)
          }
        }
      });
    }
    else {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: taskHeaders,
          properties: { values: [ ...values ] }
        }
      });
    }
  }

  // zeebe:Property
  if (type === ZEEBE_PROPERTY_TYPE) {
    let zeebeProperties = findExtension(extensionElements, 'zeebe:Properties');

    if (!zeebeProperties)
      return;

    const oldZeebeProperty = findZeebeProperty(zeebeProperties, binding);

    const properties = zeebeProperties.get('properties').filter((property) => property !== oldZeebeProperty);

    if (!properties.length) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: extensionElements,
          properties: {
            values: without(extensionElements.get('values'), zeebeProperties)
          }
        }
      });
    } else {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          ...context,
          moddleElement: zeebeProperties,
          properties: {
            properties: [ ...properties ]
          }
        }
      });
    }
  }

  // bpmn:Message#property
  if (type === MESSAGE_PROPERTY_TYPE) {
    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        ...context,
        moddleElement: businessObject,
        properties: {
          [ binding.name ]: undefined
        }
      }
    });
  }

  // bpmn:Message#zeebe:subscription#property
  if (type === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE) {
    const subscription = findZeebeSubscription(businessObject);

    if (!subscription) {
      return;
    }

    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        ...context,
        moddleElement: subscription,
        properties: {
          [ binding.name ]: undefined
        }
      }
    });
  }


  if (commands.length) {
    commandStack.execute(
      'element-templates.multi-command-executor',
      commands
    );

    return;
  }
}

// TODO(@barmac): fix translate usage (https://github.com/bpmn-io/bpmn-js-element-templates/pull/53#issuecomment-1906203270)
export function validateProperty(value, property, translate = defaultTranslate) {
  const {
    constraints = {},
    label
  } = property;

  const {
    maxLength,
    minLength,
    notEmpty
  } = constraints;

  if (notEmpty && isEmpty(value)) {
    return `${label} ${translate('must not be empty.')}`;
  }

  if (property.feel && isFeel(value)) {
    return;
  }

  if (maxLength && (value || '').length > maxLength) {
    return `${label} ${translate('must have max length {maxLength}.', { maxLength })}`;
  }

  if (minLength && (value || '').length < minLength) {
    return `${label} ${translate('must have min length {minLength}.', { minLength })}`;
  }

  let { pattern } = constraints;

  if (pattern) {
    let message;

    if (!isString(pattern)) {
      message = pattern.message;
      pattern = pattern.value;
    }

    if (!matchesPattern(value, pattern)) {
      if (message) {
        return `${label} ${translate(message)}`;
      }

      return `${label} ${translate('must match pattern {pattern}.', { pattern })}`;
    }
  }
}

// helpers
function unknownBindingError(element, property) {
  const businessObject = getBusinessObject(element);

  const id = businessObject.get('id');

  const { binding } = property;

  const { type } = binding;

  return new Error(`unknown binding <${ type }> for element <${ id }>, this should never happen`);
}

function isEmpty(value) {
  if (typeof value === 'string') {
    return !value.trim().length;
  }

  return value === undefined;
}

function matchesPattern(string, pattern) {
  return new RegExp(pattern).test(string);
}

function isOnlyProperty(moddleElement, propertyName) {
  const descriptor = moddleElement.$descriptor;

  return descriptor.properties.every(({ name }) => {
    return propertyName === name || moddleElement.get(name) === undefined;
  });
}

function defaultTranslate(template, replacements) {

  replacements = replacements || {};

  return template.replace(/{([^}]+)}/g, function(_, key) {
    return replacements[key] || '{' + key + '}';
  });
}

function isFeel(value) {
  return isString(value) && value.trim().startsWith('=');
}