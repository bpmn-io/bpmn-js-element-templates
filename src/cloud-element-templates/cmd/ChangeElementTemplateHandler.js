import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  findExtension,
  findMessage,
  findSignal,
  getDefaultFixedValue,
  getDefaultValue,
  getTemplateVersion,
  getTemplateId,
  getTemplateIcon
} from '../Helper';

import {
  createInputParameter,
  createOutputParameter,
  createTaskHeader,
  createZeebeProperty,
  shouldUpdate
} from '../CreateHelper';

import {
  find,
  without
} from 'min-dash';

import {
  MESSAGE_BINDING_TYPES,
  MESSAGE_PROPERTY_TYPE,
  MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE,
  SIGNAL_PROPERTY_TYPE,
  TASK_DEFINITION_TYPES,
  ZEEBE_CALLED_DECISION,
  ZEEBE_CALLED_ELEMENT,
  ZEEBE_LINKED_RESOURCE_PROPERTY,
  ZEEBE_SCRIPT_TASK,
  ZEEBE_USER_TASK,
  ZEEBE_FORM_DEFINITION,
  ZEEBE_ASSIGNMENT_DEFINITION,
  ZEEBE_PRIORITY_DEFINITION,
  ZEEBE_AD_HOC,
  ZEEBE_TASK_SCHEDULE
} from '../util/bindingTypes';

import {
  getTaskDefinitionPropertyName
} from '../util/taskDefinition';

import {
  createElement,
  getRoot
} from '../../utils/ElementUtil';
import { removeMessage, removeSignal } from '../util/rootElementUtil';
import { isExpression, createExpression } from '../util/bpmnExpressionUtil';

/**
 * Applies an element template to an element. Sets `zeebe:modelerTemplate` and
 * `zeebe:modelerTemplateVersion`.
 */
export default class ChangeElementTemplateHandler {
  constructor(bpmnFactory, bpmnReplace, commandStack, modeling, moddleCopy, injector) {
    this._bpmnFactory = bpmnFactory;
    this._bpmnReplace = bpmnReplace;

    this._modeling = modeling;
    this._moddleCopy = moddleCopy;
    this._commandStack = commandStack;

    this._injector = injector;
  }

  /**
   * Change an element's template and update its properties as specified in `newTemplate`. Specify
   * `oldTemplate` to update from one template to another. If `newTemplate` isn't specified the
   * `zeebe:modelerTemplate` and `zeebe:modelerTemplateVersion` properties will be removed from
   * the element.
   *
   * @param {Object} context
   * @param {Object} context.element
   * @param {Object} [context.oldTemplate]
   * @param {Object} [context.newTemplate]
   */
  preExecute(context) {
    let newTemplate = context.newTemplate,
        oldTemplate = context.oldTemplate;

    let element = context.element;

    // update zeebe:modelerTemplate attribute
    this._updateZeebeModelerTemplate(element, newTemplate);

    // update zeebe:modelerTemplateIcon
    this._updateZeebeModelerTemplateIcon(element, newTemplate);

    if (newTemplate) {

      // update element type
      element = context.element = this._updateElementType(element, oldTemplate, newTemplate);

      // update properties
      this._updateProperties(element, oldTemplate, newTemplate);

      // update zeebe:TaskDefinition
      this._updateZeebeTaskDefinition(element, oldTemplate, newTemplate);

      // update zeebe:Input and zeebe:Output properties
      this._updateZeebeInputOutputParameterProperties(element, oldTemplate, newTemplate);

      // update zeebe:Header properties
      this._updateZeebeTaskHeaderProperties(element, oldTemplate, newTemplate);

      // update zeebe:Property properties
      this._updateZeebePropertyProperties(element, oldTemplate, newTemplate);

      this._updateMessage(element, oldTemplate, newTemplate);

      this._updateSignal(element, oldTemplate, newTemplate);

      this._updateZeebeModelerTemplateOnReferencedElement(element, oldTemplate, newTemplate);

      this._updateCalledElement(element, oldTemplate, newTemplate);

      this._updateLinkedResources(element, oldTemplate, newTemplate);

      this._updateZeebeUserTask(element, newTemplate);

      this._updateCalledDecision(element, oldTemplate, newTemplate);

      this._updateZeebeFormDefinition(element, oldTemplate, newTemplate);

      this._updateScriptTask(element, oldTemplate, newTemplate);

      this._updateZeebeAssignmentDefinition(element, oldTemplate, newTemplate);

      this._updateZeebePriorityDefinition(element, oldTemplate, newTemplate);

      this._updateAdHoc(element, oldTemplate, newTemplate);

      this._updateZeebeTaskSchedule(element, oldTemplate, newTemplate);
    }
  }

  _getOrCreateExtensionElements(element, businessObject = getBusinessObject(element)) {
    const bpmnFactory = this._bpmnFactory,
          modeling = this._modeling;

    let extensionElements = businessObject.get('extensionElements');

    if (!extensionElements) {
      extensionElements = bpmnFactory.create('bpmn:ExtensionElements', {
        values: []
      });

      extensionElements.$parent = businessObject;

      modeling.updateModdleProperties(element, businessObject, {
        extensionElements: extensionElements
      });
    }

    return extensionElements;
  }

  _updateZeebeModelerTemplate(element, newTemplate) {
    const modeling = this._modeling;

    const newId = newTemplate && newTemplate.id;
    const newVersion = newTemplate && newTemplate.version;

    if (getTemplateId(element) !== newId || getTemplateVersion(element) !== newVersion) {
      modeling.updateProperties(element, {
        'zeebe:modelerTemplate': newId,
        'zeebe:modelerTemplateVersion': newVersion
      });
    }
  }

  _updateZeebeModelerTemplateIcon(element, newTemplate) {
    const modeling = this._modeling;

    const newIcon = newTemplate && newTemplate.icon;
    const newIconContents = newIcon && newIcon.contents;

    if (getTemplateIcon(element) !== newIconContents) {
      modeling.updateProperties(element, {
        'zeebe:modelerTemplateIcon': newIconContents
      });
    }
  }

  _updateProperties(element, oldTemplate, newTemplate) {
    const commandStack = this._commandStack;
    const businessObject = getBusinessObject(element);

    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === 'property';
    });

    // Remove old Properties if no new Properties specified
    const propertiesToRemove = oldTemplate && oldTemplate.properties.filter((oldProperty) => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      return oldBindingType === 'property' && !newProperties.find((newProperty) => newProperty.binding.name === oldProperty.binding.name);
    }) || [];

    if (propertiesToRemove.length) {
      const payload = propertiesToRemove.reduce((properties, property) => {
        properties[property.binding.name] = undefined;
        return properties;
      }, {});

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: payload
      });
    }

    if (!newProperties.length) {
      return;
    }

    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            newBinding = newProperty.binding,
            newBindingName = newBinding.name,
            newPropertyValue = getDefaultValue(newProperty),
            changedElement = businessObject;

      let properties = {};

      if (shouldKeepValue(changedElement, oldProperty, newProperty)) {
        return;
      }

      let assignedValue = newPropertyValue;
      if (isExpression(businessObject, newBindingName)) {
        assignedValue = createExpression(newPropertyValue, businessObject, this._bpmnFactory);
      }

      properties[ newBindingName ] = assignedValue;

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties
      });
    });
  }

  /**
   * Update `zeebe:TaskDefinition` properties of specified business object. This
   * can only exist in `bpmn:ExtensionElements`.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateZeebeTaskDefinition(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: TASK_DEFINITION_TYPES,
        extensionType: 'zeebe:TaskDefinition',
        getPropertyName: getTaskDefinitionPropertyName
      }
    );
  }

  /**
   * Update `zeebe:Input` and `zeebe:Output` properties of specified business
   * object. Both can only exist in `zeebe:ioMapping` which can exist in `bpmn:ExtensionElements`.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateZeebeInputOutputParameterProperties(element, oldTemplate, newTemplate) {
    const bpmnFactory = this._bpmnFactory,
          commandStack = this._commandStack;

    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === 'zeebe:input' || newBindingType === 'zeebe:output';
    });

    const businessObject = this._getOrCreateExtensionElements(element);

    let ioMapping = findExtension(businessObject, 'zeebe:IoMapping');

    // (1) remove old mappings if no new specified
    if (!newProperties.length) {
      if (!ioMapping) {
        return;
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: without(businessObject.get('values'), ioMapping)
        }
      });
    }

    if (!ioMapping) {
      ioMapping = bpmnFactory.create('zeebe:IoMapping');

      ioMapping.$parent = businessObject;

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: [ ...businessObject.get('values'), ioMapping ]
        }
      });
    }

    const oldInputs = ioMapping.get('zeebe:inputParameters')
      ? ioMapping.get('zeebe:inputParameters').slice()
      : [];

    const oldOutputs = ioMapping.get('zeebe:outputParameters')
      ? ioMapping.get('zeebe:outputParameters').slice()
      : [];

    let propertyName;

    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            inputOrOutput = findBusinessObject(businessObject, newProperty),
            newPropertyValue = getDefaultValue(newProperty),
            newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      let newInputOrOutput,
          properties;

      // (2) update old inputs and outputs
      if (inputOrOutput) {

        // (2a) exclude old inputs and outputs from cleanup, unless
        // a) optional and has empty value, and
        // b) not changed
        if (
          shouldUpdate(newPropertyValue, newProperty) ||
          shouldKeepValue(inputOrOutput, oldProperty, newProperty)
        ) {
          if (is(inputOrOutput, 'zeebe:Input')) {
            remove(oldInputs, inputOrOutput);
          } else {
            remove(oldOutputs, inputOrOutput);
          }
        }

        // (2a) do updates (unless changed)
        if (!shouldKeepValue(inputOrOutput, oldProperty, newProperty)) {

          if (is(inputOrOutput, 'zeebe:Input')) {
            properties = {
              source: newPropertyValue
            };
          } else {
            properties = {
              target: newPropertyValue
            };
          }

          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: inputOrOutput,
            properties
          });
        }
      }

      // (3) add new inputs and outputs (unless optional)
      else if (shouldUpdate(newPropertyValue, newProperty)) {

        if (newBindingType === 'zeebe:input') {
          propertyName = 'inputParameters';

          newInputOrOutput = createInputParameter(newBinding, newPropertyValue, bpmnFactory);
        } else {
          propertyName = 'outputParameters';

          newInputOrOutput = createOutputParameter(newBinding, newPropertyValue, bpmnFactory);
        }

        newInputOrOutput.$parent = ioMapping;

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: ioMapping,
          properties: {
            [ propertyName ]: [ ...ioMapping.get(propertyName), newInputOrOutput ]
          }
        });
      }
    });

    // (4) remove old inputs and outputs
    if (oldInputs.length) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: ioMapping,
        properties: {
          inputParameters: without(ioMapping.get('inputParameters'), inputParameter => oldInputs.includes(inputParameter))
        }
      });
    }

    if (oldOutputs.length) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: ioMapping,
        properties: {
          outputParameters: without(ioMapping.get('outputParameters'), outputParameter => oldOutputs.includes(outputParameter))
        }
      });
    }
  }

  /**
   * Update `zeebe:Header` properties of specified business
   * object. Those can only exist in `zeebe:taskHeaders` which can exist in `bpmn:ExtensionElements`.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateZeebeTaskHeaderProperties(element, oldTemplate, newTemplate) {
    const bpmnFactory = this._bpmnFactory,
          commandStack = this._commandStack;

    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === 'zeebe:taskHeader';
    });

    const businessObject = this._getOrCreateExtensionElements(element);

    let taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders');

    // (1) remove old headers if no new specified
    if (!newProperties.length) {
      if (!taskHeaders) {
        return;
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: without(businessObject.get('values'), taskHeaders)
        }
      });
    }

    if (!taskHeaders) {
      taskHeaders = bpmnFactory.create('zeebe:TaskHeaders');

      taskHeaders.$parent = businessObject;

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: [ ...businessObject.get('values'), taskHeaders ]
        }
      });
    }

    const oldHeaders = taskHeaders.get('zeebe:values')
      ? taskHeaders.get('zeebe:values').slice()
      : [];

    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            oldHeader = findBusinessObject(businessObject, newProperty),
            newPropertyValue = getDefaultValue(newProperty),
            newBinding = newProperty.binding;

      // (2) update old headers
      if (oldHeader) {

        if (!shouldKeepValue(oldHeader, oldProperty, newProperty)) {
          const properties = {
            value: newPropertyValue
          };

          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: oldHeader,
            properties
          });
        }

        remove(oldHeaders, oldHeader);
      }

      // (3) add new (non-empty) headers
      else if (newPropertyValue) {
        const newHeader = createTaskHeader(newBinding, newPropertyValue, bpmnFactory);

        newHeader.$parent = taskHeaders;

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: taskHeaders,
          properties: {
            values: [ ...taskHeaders.get('values'), newHeader ]
          }
        });
      }
    });

    // (4) remove old headers
    if (oldHeaders.length) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: taskHeaders,
        properties: {
          values: without(taskHeaders.get('values'), header => oldHeaders.includes(header))
        }
      });
    }
  }

  /**
   * Update zeebe:Property properties of zeebe:Properties extension element.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateZeebePropertyProperties(element, oldTemplate, newTemplate) {
    const bpmnFactory = this._bpmnFactory,
          commandStack = this._commandStack;

    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === 'zeebe:property';
    });

    const businessObject = this._getOrCreateExtensionElements(element);

    let zeebeProperties = findExtension(businessObject, 'zeebe:Properties');

    // (1) remove old zeebe:Properties if no new zeebe:Property properties
    if (!newProperties.length) {
      if (!zeebeProperties) {
        return;
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: without(businessObject.get('values'), zeebeProperties)
        }
      });
    }

    if (!zeebeProperties) {
      zeebeProperties = bpmnFactory.create('zeebe:Properties');

      zeebeProperties.$parent = businessObject;

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: [ ...businessObject.get('values'), zeebeProperties ]
        }
      });
    }

    const oldZeebeProperties = zeebeProperties.get('properties')
      ? zeebeProperties.get('properties').slice()
      : [];

    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            oldZeebeProperty = findBusinessObject(businessObject, newProperty),
            newPropertyValue = getDefaultValue(newProperty),
            newBinding = newProperty.binding;

      // (2) update old zeebe:Property
      if (oldZeebeProperty) {
        if (shouldUpdate(newPropertyValue, newProperty)
          || shouldKeepValue(oldZeebeProperty, oldProperty, newProperty)) {
          remove(oldZeebeProperties, oldZeebeProperty);
        }

        if (!shouldKeepValue(oldZeebeProperty, oldProperty, newProperty)) {
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: oldZeebeProperty,
            properties: {
              value: newPropertyValue
            }
          });
        }
      }

      // (3) add new zeebe:Property
      else if (shouldUpdate(newPropertyValue, newProperty)) {
        const newProperty = createZeebeProperty(newBinding, newPropertyValue, bpmnFactory);

        newProperty.$parent = zeebeProperties;

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: zeebeProperties,
          properties: {
            properties: [ ...zeebeProperties.get('properties'), newProperty ]
          }
        });
      }
    });

    // (4) remove old zeebe:Property
    if (oldZeebeProperties.length) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: zeebeProperties,
        properties: {
          properties: without(zeebeProperties.get('properties'), zeebeProperty => oldZeebeProperties.includes(zeebeProperty))
        }
      });
    }
  }

  _updateMessage(element, oldTemplate, newTemplate) {

    // update bpmn:Message properties
    this._updateMessageProperties(element, oldTemplate, newTemplate);

    // update bpmn:Message zeebe:subscription properties
    this._updateMessageZeebeSubscriptionProperties(element, oldTemplate, newTemplate);

    if (!hasMessageProperties(newTemplate)) {
      removeMessage(element, this._injector);
    }
  }

  _updateSignal(element, oldTemplate, newTemplate) {

    // update bpmn:Signal properties
    this._updateSignalProperties(element, oldTemplate, newTemplate);

    if (!hasSignalProperties(newTemplate)) {
      removeSignal(element, this._injector);
    }
  }

  /**
   * Update bpmn:Message properties.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateMessageProperties(element, oldTemplate, newTemplate) {
    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === MESSAGE_PROPERTY_TYPE;
    });

    const removedProperties = oldTemplate && oldTemplate.properties.filter((oldProperty) => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      return oldBindingType === MESSAGE_PROPERTY_TYPE && !newProperties.find((newProperty) => newProperty.binding.name === oldProperty.binding.name);
    }) || [];

    let message = this._getMessage(element);
    message && removedProperties.forEach((removedProperty) => {

      this._modeling.updateModdleProperties(element, message, {
        [removedProperty.binding.name]: undefined
      });
    });

    if (!newProperties.length) {
      return;
    }

    message = this._ensureMessage(element, newTemplate);

    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            newBinding = newProperty.binding,
            newBindingName = newBinding.name,
            newPropertyValue = getDefaultValue(newProperty),
            changedElement = message;

      let properties = {};

      if (shouldKeepValue(changedElement, oldProperty, newProperty)) {
        return;
      }

      properties[ newBindingName ] = newPropertyValue;

      this._modeling.updateModdleProperties(element, changedElement, properties);
    });
  }

  /**
   * Update bpmn:Signal properties.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateSignalProperties(element, oldTemplate, newTemplate) {
    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === SIGNAL_PROPERTY_TYPE;
    });

    const removedProperties = oldTemplate && oldTemplate.properties.filter((oldProperty) => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      return oldBindingType === SIGNAL_PROPERTY_TYPE && !newProperties.find((newProperty) => newProperty.binding.name === oldProperty.binding.name);
    }) || [];

    let signal = this._getSignal(element);
    signal && removedProperties.forEach((removedProperty) => {

      this._modeling.updateModdleProperties(element, signal, {
        [removedProperty.binding.name]: undefined
      });
    });

    if (!newProperties.length) {
      return;
    }

    // The template schema guarantees that if signal#property is active
    signal = this._ensureSignal(element, newTemplate);

    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            newBinding = newProperty.binding,
            newBindingName = newBinding.name,
            newPropertyValue = getDefaultValue(newProperty),
            changedElement = signal;

      let properties = {};

      if (shouldKeepValue(changedElement, oldProperty, newProperty)) {
        return;
      }

      properties[ newBindingName ] = newPropertyValue;

      this._modeling.updateModdleProperties(element, changedElement, properties);
    });
  }

  /**
   * Update bpmn:Message#zeebe:subscription properties.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateMessageZeebeSubscriptionProperties(element, oldTemplate, newTemplate) {
    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE;
    });

    const removedProperties = oldTemplate && oldTemplate.properties.filter((oldProperty) => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      return oldBindingType === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE && !newProperties.find((newProperty) => newProperty.binding.name === oldProperty.binding.name);
    }) || [];

    if (!newProperties.length && !removedProperties.length) {
      return;
    }

    let message = this._getMessage(element);

    // no new properties and no message -> nothing to do
    if (!newProperties.length && !message) {
      return;
    }

    message = this._ensureMessage(element, newTemplate);

    const messageExtensionElements = this._getOrCreateExtensionElements(element, message);
    const zeebeSubscription = this._getSubscription(element, message);

    const propertiesToSet = newProperties.reduce((properties, newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            newBinding = newProperty.binding,
            newBindingName = newBinding.name,
            newPropertyValue = getDefaultValue(newProperty),
            changedElement = zeebeSubscription;

      if (shouldKeepValue(changedElement, oldProperty, newProperty)) {
        return properties;
      }

      properties[ newBindingName ] = newPropertyValue;
      return properties;
    }, {});

    // Update zeebe Subscription
    if (zeebeSubscription) {
      this._modeling.updateModdleProperties(element, zeebeSubscription,
        propertiesToSet
      );
    } else {

      // create new Subscription
      const newSubscription = createElement('zeebe:Subscription', propertiesToSet, message, this._bpmnFactory);
      this._modeling.updateModdleProperties(element, messageExtensionElements, {
        values: [ ...messageExtensionElements.get('values'), newSubscription ]
      });
    }

    // Remove old properties
    if (!oldTemplate || !zeebeSubscription) {
      return;
    }

    const propertiesToRemove = removedProperties.reduce((properties, removedProperty) => {
      properties[ removedProperty.binding.name ] = undefined;
      return properties;
    }, {});

    this._modeling.updateModdleProperties(element, zeebeSubscription,
      propertiesToRemove
    );
  }

  _updateZeebeModelerTemplateOnReferencedElement(element, oldTemplate, newTemplate) {
    const businessObject = getBusinessObject(element);

    const referencedElement = findMessage(businessObject) || findSignal(businessObject);

    if (referencedElement && getTemplateId(referencedElement) !== newTemplate.id) {
      this._modeling.updateModdleProperties(element, referencedElement, {
        'zeebe:modelerTemplate': newTemplate.id
      });
    }
  }

  _getSubscription(element, bo) {
    const extensionElements = this._getOrCreateExtensionElements(element, bo);

    const extension = findExtension(extensionElements, 'zeebe:Subscription');

    if (extension) {
      return extension;
    }
  }

  _createMessage(element, template) {
    let bo = getBusinessObject(element);

    if (is(bo, 'bpmn:Event')) {
      bo = bo.get('eventDefinitions')[0];
    }

    const message = this._bpmnFactory.create('bpmn:Message', { 'zeebe:modelerTemplate': template.id });

    message.$parent = getRoot(bo);

    this._modeling.updateModdleProperties(element, bo, { messageRef: message });

    return message;
  }

  _createSignal(element, template) {
    let bo = getBusinessObject(element);

    if (is(bo, 'bpmn:Event')) {
      bo = bo.get('eventDefinitions')[0];
    }

    const signal = this._bpmnFactory.create('bpmn:Signal', { 'zeebe:modelerTemplate': template.id });

    signal.$parent = getRoot(bo);

    this._modeling.updateModdleProperties(element, bo, { signalRef: signal });

    return signal;
  }

  _getMessage(element) {
    let bo = getBusinessObject(element);

    if (is(bo, 'bpmn:Event')) {
      bo = bo.get('eventDefinitions')[0];
    }

    return bo && bo.get('messageRef');
  }

  _getSignal(element) {
    let bo = getBusinessObject(element);

    if (!is(bo, 'bpmn:Event')) {
      return;
    }

    const eventDefinition = bo.get('eventDefinitions')[0];

    return eventDefinition && eventDefinition.get('signalRef');
  }

  _ensureMessage(element, template) {

    const message = this._getMessage(element);

    // message is already templated, so we use it
    if (message && message.get('zeebe:modelerTemplate')) {
      return message;
    }

    const newMessage = this._createMessage(element, template);

    // no message is set on the element, so no properties to copy
    if (!message) {
      return newMessage;
    }

    return this._moddleCopy.copyElement(message, newMessage, [ 'name', 'extensionElements' ]);
  }

  _ensureSignal(element, template) {

    const signal = this._getSignal(element);

    // signal is already templated, so we use it
    if (signal && signal.get('zeebe:modelerTemplate')) {
      return signal;
    }

    const newSignal = this._createSignal(element, template);

    // no signal is set on the element, so no properties to copy
    if (!signal) {
      return newSignal;
    }

    return this._moddleCopy.copyElement(signal, newSignal, [ 'name' ]);
  }


  /**
   * Update `zeebe:CalledElement` properties of specified business object. This
   * can only exist in `bpmn:ExtensionElements`.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateCalledElement(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_CALLED_ELEMENT ],
        extensionType: 'zeebe:CalledElement',
        getPropertyName: (binding) => binding.property
      }
    );
  }

  /**
   * Update `zeebe:CalledDecision` properties of specified business object. This
   * can only exist in `bpmn:ExtensionElements`.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateCalledDecision(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_CALLED_DECISION ],
        extensionType: 'zeebe:CalledDecision',
        getPropertyName: (binding) => binding.property
      }
    );
  }

  /**
   * Update `zeebe:Script` properties of specified business object. This
   * can only exist in `bpmn:ExtensionElements`.
   *
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateScriptTask(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_SCRIPT_TASK ],
        extensionType: 'zeebe:Script',
        getPropertyName: (binding) => binding.property
      }
    );
  }

  _updateZeebeAssignmentDefinition(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_ASSIGNMENT_DEFINITION ],
        extensionType: 'zeebe:AssignmentDefinition',
        getPropertyName: (binding) => binding.property
      }
    );
  }

  _updateZeebePriorityDefinition(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_PRIORITY_DEFINITION ],
        extensionType: 'zeebe:PriorityDefinition',
        getPropertyName: (binding) => binding.property
      }
    );
  }

  _updateAdHoc(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_AD_HOC ],
        extensionType: 'zeebe:AdHoc',
        getPropertyName: (binding) => binding.property
      }
    );
  }


  _updateZeebeTaskSchedule(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_TASK_SCHEDULE ],
        extensionType: 'zeebe:TaskSchedule',
        getPropertyName: (binding) => binding.property
      }
    );
  }

  /**
   * Replaces the element with the specified elementType.
   * Takes into account the eventDefinition for events.
   *
   * @param {djs.model.Base} element
   * @param {Object} newTemplate
   */
  _updateElementType(element, oldTemplate, newTemplate) {

    // determine new task type
    const newType = newTemplate.elementType;

    if (!newType) {
      return element;
    }


    // Do not replace if the element type did not change
    if (!shouldUpdateElementType(element, oldTemplate, newType)) {
      return element;
    }

    const replacement = { type: newType.value };

    if (newType.eventDefinition) {
      replacement.eventDefinitionType = newType.eventDefinition;
    }

    const replacedElement = this._bpmnReplace.replaceElement(element, replacement);

    return replacedElement;
  }


  _updateLinkedResources(element, oldTemplate, newTemplate) {
    const bpmnFactory = this._bpmnFactory,
          commandStack = this._commandStack;

    const newLinkedResources = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return newBindingType === 'zeebe:linkedResource';
    });

    const extensionElements = this._getOrCreateExtensionElements(element);

    let linkedResources = findExtension(extensionElements, 'zeebe:LinkedResources');

    // (1) remove linkedResourcess if no new specified
    if (!newLinkedResources.length) {
      if (!linkedResources) {
        return;
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: extensionElements,
        properties: {
          values: without(extensionElements.get('values'), linkedResources)
        }
      });
      return;
    }

    if (!linkedResources) {
      linkedResources = bpmnFactory.create('zeebe:LinkedResources');

      linkedResources.$parent = extensionElements;

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: extensionElements,
        properties: {
          values: [ ...extensionElements.get('values'), linkedResources ]
        }
      });
    }

    const unusedLinkedResources = linkedResources.get('values').slice();
    const unusedResourceProperties = (oldTemplate?.properties.slice() || [])
      .filter((property) => property.binding.type === ZEEBE_LINKED_RESOURCE_PROPERTY);

    newLinkedResources.forEach((newLinkedResource) => {
      const oldProperty = findOldProperty(oldTemplate, newLinkedResource),
            oldLinkedResource = findBusinessObject(extensionElements, newLinkedResource),
            newPropertyValue = getDefaultValue(newLinkedResource),
            newBinding = newLinkedResource.binding;

      if (oldProperty) {
        remove(unusedResourceProperties, oldProperty);
      }

      // (2) update old LinkesResources
      if (oldLinkedResource) {
        if (
          shouldUpdate(newPropertyValue, newLinkedResource)
          || shouldKeepValue(oldLinkedResource, oldProperty, newLinkedResource)
        ) {
          remove(unusedLinkedResources, oldLinkedResource);
        }

        if (!shouldKeepValue(oldLinkedResource, oldProperty, newLinkedResource)) {
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: oldLinkedResource,
            properties: {
              [newBinding.property]: newPropertyValue
            }
          });
        }
      }

      // (3) add new linkedResources
      else if (shouldUpdate(newPropertyValue, newLinkedResource)) {
        const newProperties = {
          linkName: newBinding.linkName,
          [newBinding.property]: newPropertyValue
        };

        const newLinkedResource = createElement('zeebe:LinkedResource', newProperties, extensionElements, bpmnFactory);

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: linkedResources,
          properties: {
            values: [ ...linkedResources.get('values'), newLinkedResource ]
          }
        });
      }
    });


    // (4) remove unused linkedResources
    if (unusedLinkedResources.length) {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: linkedResources,
        properties: {
          values: without(linkedResources.get('values'), linkedResource => unusedLinkedResources.includes(linkedResource))
        }
      });
    }

    // (5) remove unused resource properties
    unusedResourceProperties.forEach((unusedResourceProperty) => {
      const oldLinkedResource = findBusinessObject(extensionElements, unusedResourceProperty);

      const oldBinding = unusedResourceProperty.binding;

      // No property was reused and element was removed in previous step
      if (!oldLinkedResource) {
        return;
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: oldLinkedResource,
        properties: {
          [oldBinding.property]: undefined
        }
      });
    });
  }

  _updateZeebeUserTask = function(element, newTemplate) {

    const commandStack = this._commandStack;
    const bpmnFactory = this._bpmnFactory;

    // check if template has zeebe:userTask binding property
    const hasBinding = newTemplate.properties.some((property) =>
      property.binding.type === ZEEBE_USER_TASK);

    // check if element has zeebe:UserTask extension element
    const extensionElements = getBusinessObject(element).get('extensionElements');
    const userTaskExtension = findExtension(element, 'zeebe:UserTask');

    if (newTemplate.elementType?.value !== 'bpmn:UserTask') {
      return;
    }

    // remove zeebe:UserTask if no binding
    if (userTaskExtension) {

      !hasBinding && commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: extensionElements,
        properties: {
          values: without(extensionElements.get('values'), userTaskExtension)
        }
      });

      return;
    }

    if (!hasBinding) {
      return;
    }

    // create new zeebe:UserTask extension element
    const zeebeUserTask = bpmnFactory.create('zeebe:UserTask');
    zeebeUserTask.$parent = extensionElements;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: {
        values: [ ...extensionElements.get('values'), zeebeUserTask ]
      }
    });
  };

  /**
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   */
  _updateZeebeFormDefinition = function(element, oldTemplate, newTemplate) {
    this._updateSingleExtensionElement(
      element,
      oldTemplate,
      newTemplate,
      {
        bindingTypes: [ ZEEBE_FORM_DEFINITION ],
        extensionType: 'zeebe:FormDefinition',
        getPropertyName: (binding) => binding.property
      }
    );
  };

  /**
   * Generic handler for updating extension elements that are single instances with properties.
   *
   * @example
   * For this template
   * ```json
   * {
   *   properties: [
   *    { binding: { type: 'zeebe:taskDefinition', property: 'type' }, value: 'myTaskType' },
   *    {binding: { type: 'zeebe:taskDefinition', property: 'retries' }, value: 3}
   *   ]
   * }
   *```
   * `getPropertyName` should return `binding.property`.
   *
   * `bindingTypes` should be an array of binding types to consider, e.g. `['zeebe:taskDefinition']`.
   *
   * `extensionType` should be the type of the extension element to update, e.g. `'zeebe:TaskDefinition'`.
   *
   * The resulting XML will look like this:
   *
   * ```xml
   * <bpmn:extensionElements>
   *   <zeebe:taskDefinition type="myTaskType" retries="3" />
   * </bpmn:extensionElements>
   *```
   * @param {djs.model.Base} element
   * @param {Object} oldTemplate
   * @param {Object} newTemplate
   * @param {Object} opts
   * @param {Array<string>} opts.bindingTypes - binding types to consider
   * @param {string} opts.extensionType - type of the extension element to update
   * @param {(binding:object) => string} opts.getPropertyName - function to get the property name for the binding
   */
  _updateSingleExtensionElement(element, oldTemplate, newTemplate, opts) {
    const { bindingTypes, extensionType, getPropertyName } = opts;
    const bpmnFactory = this._bpmnFactory,
          commandStack = this._commandStack;

    const newProperties = newTemplate.properties.filter((newProperty) => {
      const newBinding = newProperty.binding,
            newBindingType = newBinding.type;

      return bindingTypes.includes(newBindingType);
    });

    const businessObject = this._getOrCreateExtensionElements(element);
    let extensionElement = findExtension(businessObject, extensionType);

    // (1) Remove extension if no new properties

    if (!newProperties.length) {
      if (!extensionElement) {
        return;
      }

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: businessObject,
        properties: {
          values: without(businessObject.get('values'), extensionElement)
        }
      });

      return;
    }

    // If there are new properties:
    newProperties.forEach((newProperty) => {
      const oldProperty = findOldProperty(oldTemplate, newProperty),
            newPropertyValue = getDefaultValue(newProperty),
            newBinding = newProperty.binding,
            propertyName = getPropertyName(newBinding);

      // (2) Update old extension with new property values
      if (extensionElement) {

        if (!shouldKeepValue(extensionElement, oldProperty, newProperty)) {
          const properties = {
            [propertyName]: newPropertyValue
          };
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: extensionElement,
            properties
          });
        }
      }

      // (3) Add new extension with properties if it does not exist
      else {
        const properties = {
          [propertyName]: newPropertyValue
        };

        extensionElement = bpmnFactory.create(extensionType, properties);

        extensionElement.$parent = businessObject;

        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: businessObject,
          properties: {
            values: [ ...businessObject.get('values'), extensionElement ]
          }
        });
      }
    });

    // (4) Remove properties no longer templated
    const oldProperties = oldTemplate && oldTemplate.properties.filter((oldProperty) => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type,
            oldPropertyName = getPropertyName(oldBinding);

      return bindingTypes.includes(oldBindingType) &&
        !newProperties.find((newProperty) => oldPropertyName === getPropertyName(newProperty.binding));
    }) || [];

    oldProperties.forEach((oldProperty) => {
      const properties = {
        [ getPropertyName(oldProperty.binding) ]: undefined
      };

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: extensionElement,
        properties
      });
    });
  }
}

ChangeElementTemplateHandler.$inject = [
  'bpmnFactory',
  'bpmnReplace',
  'commandStack',
  'modeling',
  'moddleCopy',
  'injector'
];


// helpers //////////

/**
 * Find business object matching specified property.
 *
 * @param {djs.model.Base|ModdleElement} element
 * @param {Object} property
 *
 * @returns {ModdleElement}
 */
function findBusinessObject(element, property) {
  const businessObject = getBusinessObject(element);

  const binding = property.binding,
        bindingType = binding.type;

  if (TASK_DEFINITION_TYPES.includes(bindingType)) {
    return findExtension(businessObject, 'zeebe:TaskDefinition');
  }

  if (bindingType === 'zeebe:input' || bindingType === 'zeebe:output') {

    const extensionElements = findExtension(businessObject, 'zeebe:IoMapping');

    if (!extensionElements) {
      return;
    }

    if (bindingType === 'zeebe:input') {
      return find(extensionElements.get('zeebe:inputParameters'), function(input) {
        return input.get('zeebe:target') === binding.name;
      });
    } else {
      return find(extensionElements.get('zeebe:outputParameters'), function(output) {
        return output.get('zeebe:source') === binding.source;
      });
    }

  }

  if (bindingType === 'zeebe:taskHeader') {
    const extensionElements = findExtension(businessObject, 'zeebe:TaskHeaders');

    if (!extensionElements) {
      return;
    }

    return find(extensionElements.get('zeebe:values'), function(value) {
      return value.get('zeebe:key') === binding.key;
    });
  }

  if (bindingType === 'zeebe:property') {
    const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');

    if (!zeebeProperties) {
      return;
    }

    return zeebeProperties.get('properties').find((value) => {
      return value.get('name') === binding.name;
    });
  }

  if (bindingType === ZEEBE_LINKED_RESOURCE_PROPERTY) {
    const linkedResources = findExtension(businessObject, 'zeebe:LinkedResources');

    if (!linkedResources) {
      return;
    }

    return linkedResources.get('values').find((value) => {
      return value.get('linkName') === binding.linkName;
    });
  }
}

/**
 * Find old property matching specified new property.
 *
 * @param {Object} oldTemplate
 * @param {Object} newProperty
 *
 * @returns {Object}
 */
export function findOldProperty(oldTemplate, newProperty) {
  if (!oldTemplate) {
    return;
  }

  const oldProperties = oldTemplate.properties,
        newBinding = newProperty.binding,
        newBindingName = newBinding.name,
        newBindingType = newBinding.type;

  if (newBindingType === 'property') {
    return find(oldProperties, function(oldProperty) {
      const oldBinding = oldProperty.binding,
            oldBindingName = oldBinding.name,
            oldBindingType = oldBinding.type;

      return oldBindingType === 'property' && oldBindingName === newBindingName;
    });
  }

  if (TASK_DEFINITION_TYPES.includes(newBindingType)) {
    return find(oldProperties, function(oldProperty) {
      const oldBinding = oldProperty.binding,
            oldPropertyName = getTaskDefinitionPropertyName(oldBinding),
            newPropertyName = getTaskDefinitionPropertyName(newBinding);

      return oldPropertyName === newPropertyName;
    });
  }

  if (newBindingType === 'zeebe:input') {
    return find(oldProperties, function(oldProperty) {
      const oldBinding = oldProperty.binding,
            oldBindingName = oldBinding.name,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== 'zeebe:input') {
        return;
      }

      return oldBindingName === newBindingName;
    });
  }

  if (newBindingType === 'zeebe:output') {
    return find(oldProperties, function(oldProperty) {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== 'zeebe:output') {
        return;
      }

      return oldBinding.source === newBinding.source;
    });
  }

  if (newBindingType === 'zeebe:taskHeader') {
    return find(oldProperties, function(oldProperty) {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== 'zeebe:taskHeader') {
        return;
      }

      return oldBinding.key === newBinding.key;
    });
  }

  if (newBindingType === 'zeebe:property') {
    return oldProperties.find((oldProperty) => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== 'zeebe:property') {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }

  if (newBindingType === MESSAGE_PROPERTY_TYPE) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== MESSAGE_PROPERTY_TYPE) {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }

  if (newBindingType === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE) {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }

  if (newBindingType === SIGNAL_PROPERTY_TYPE) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== SIGNAL_PROPERTY_TYPE) {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }

  if (newBindingType === ZEEBE_LINKED_RESOURCE_PROPERTY) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_LINKED_RESOURCE_PROPERTY) {
        return;
      }

      return oldBinding.linkName === newBinding.linkName && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_CALLED_DECISION) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_CALLED_DECISION) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_SCRIPT_TASK) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_SCRIPT_TASK) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_FORM_DEFINITION) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_FORM_DEFINITION) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_ASSIGNMENT_DEFINITION) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_ASSIGNMENT_DEFINITION) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_PRIORITY_DEFINITION) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_PRIORITY_DEFINITION) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_AD_HOC) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_AD_HOC) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }

  if (newBindingType === ZEEBE_TASK_SCHEDULE) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_TASK_SCHEDULE) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
    });
  }
}

/**
 * Check whether the existing property should be kept. This is the case if
 *  - an old template was set and the value differs from the default
 *  - no template was set but the property was set manually
 *
 * @param {djs.model.Base|ModdleElement} element
 * @param {Object} oldProperty
 * @param {Object} newProperty
 *
 * @returns {boolean}
 */
function shouldKeepValue(element, oldProperty, newProperty) {

  // "Hidden" values are treated as a constant
  if (newProperty.type === 'Hidden') {
    return false;
  }

  // Dropdowns should keep existing configuration
  // cf. https://github.com/bpmn-io/bpmn-js-properties-panel/issues/767
  if (newProperty.type === 'Dropdown') {

    const currentValue = getPropertyValue(element, newProperty);

    // only keep value if old value is a valid option
    return newProperty.choices && newProperty.choices.some(
      (choice) => choice.value === currentValue
    );
  }

  // keep existing old property if
  // user changed it from the original
  if (oldProperty) {
    return propertyChanged(element, oldProperty);
  }

  // keep existing property value
  return !!(getPropertyValue(element, newProperty));
}

/**
 * Check whether property was changed after being set by template.
 *
 * @param {djs.model.Base|ModdleElement} element
 * @param {Object} oldProperty
 *
 * @returns {boolean}
 */
function propertyChanged(element, oldProperty) {
  const oldPropertyValue = getDefaultFixedValue(oldProperty);

  return getPropertyValue(element, oldProperty) !== oldPropertyValue;
}

function getPropertyValue(element, property) {
  const businessObject = getBusinessObject(element);

  if (!businessObject) {
    return;
  }

  const binding = property.binding,
        bindingName = binding.name,
        bindingType = binding.type,
        bindingProperty = binding.property;


  if (bindingType === 'property') {
    return businessObject.get(bindingName);
  }

  if (TASK_DEFINITION_TYPES.includes(bindingType)) {
    return businessObject.get(getTaskDefinitionPropertyName(binding));
  }

  if (bindingType === 'zeebe:input') {
    return businessObject.get('zeebe:source');
  }

  if (bindingType === 'zeebe:output') {
    return businessObject.get('zeebe:target');
  }

  if (bindingType === 'zeebe:taskHeader') {
    return businessObject.get('zeebe:value');
  }

  if (bindingType === 'zeebe:property') {
    return businessObject.get('zeebe:value');
  }

  if (bindingType === MESSAGE_PROPERTY_TYPE) {
    return businessObject.get(bindingName);
  }

  if (bindingType === MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE) {
    return businessObject.get(bindingName);
  }

  if (bindingType === SIGNAL_PROPERTY_TYPE) {
    return businessObject.get(bindingName);
  }

  if (bindingType === ZEEBE_LINKED_RESOURCE_PROPERTY) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_CALLED_DECISION) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_CALLED_ELEMENT) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_FORM_DEFINITION) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_SCRIPT_TASK) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_ASSIGNMENT_DEFINITION) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_PRIORITY_DEFINITION) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_AD_HOC) {
    return businessObject.get(bindingProperty);
  }

  if (bindingType === ZEEBE_TASK_SCHEDULE) {
    return businessObject.get(bindingProperty);
  }
}

function remove(array, item) {
  const index = array.indexOf(item);

  if (index < 0) {
    return array;
  }

  array.splice(index, 1);

  return array;
}


function hasMessageProperties(template) {
  return template.properties.some(p => MESSAGE_BINDING_TYPES.includes(p.binding.type));
}

function hasSignalProperties(template) {
  return template.properties.some(p => p.binding.type === SIGNAL_PROPERTY_TYPE);
}

function shouldUpdateElementType(element, oldTemplate, newType) {

  // Never reuse existing eventDefinition when applying a new template
  if (!oldTemplate && newType.eventDefinition) {
    return true;
  }

  const oldType = oldTemplate && oldTemplate.elementType || {
    value: element.type,
    eventDefinition: getEventDefinitionType(element)
  };

  // Do not update if the element type did not change
  if (oldType && oldType.value === newType.value && oldType.eventDefinition === newType.eventDefinition) {
    return false;
  }

  return true;
}

function getEventDefinitionType(element) {
  const businessObject = getBusinessObject(element);
  if (!businessObject.eventDefinitions) {
    return;
  }

  const eventDefinition = businessObject.eventDefinitions[ 0 ];

  if (!eventDefinition) {
    return;
  }

  return eventDefinition.$type;
}