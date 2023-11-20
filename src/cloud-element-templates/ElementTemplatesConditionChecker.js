import {
  applyConditions
} from './Condition';

import { isObject } from 'min-dash';
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { setPropertyValue, unsetProperty } from './util/propertyUtil';
import { MESSAGE_BINDING_TYPES, ZEEBE_TASK_DEFINITION, ZEEBE_TASK_DEFINITION_TYPE_TYPE } from './util/bindingTypes';
import { removeMessage } from './util/rootElementUtil';

/**
 * Checks the conditions of an element template and sets/resets the
 * corresponding properties on the element.
 */
export default class ElementTemplatesConditionChecker extends CommandInterceptor {
  constructor(eventBus, elementTemplates, commandStack, bpmnFactory, injector) {
    super(eventBus);

    this._eventBus = eventBus;
    this._elementTemplates = elementTemplates;
    this._commandStack = commandStack;
    this._bpmnFactory = bpmnFactory;
    this._injector = injector;

    this.preExecute([
      'element.updateProperties', 'element.updateModdleProperties'
    ], this._saveConditionalState, true, this);

    this.postExecute([
      'element.updateProperties',
      'element.updateModdleProperties',
      'propertiesPanel.zeebe.changeTemplate',
      'element.move'
    ], this._applyConditions, true, this);
  }

  _saveConditionalState(context) {
    const {
      element
    } = context;

    const template = this._elementTemplates.get(element);

    if (!template) {
      return;
    }

    context.oldTemplate = applyConditions(element, template);
  }

  _applyConditions(context) {
    const {
      element,
      oldTemplate
    } = context;

    const template = this._elementTemplates.get(element);

    if (!template || !oldTemplate || template.id !== oldTemplate.id) {
      return;
    }

    const newTemplate = applyConditions(element, template);

    const propertiesToAdd = getMissingProperties(oldTemplate, newTemplate);
    const propertiesToRemove = getPropertiesToRemove(newTemplate, oldTemplate);

    this._updateReferencedElement(element, oldTemplate, newTemplate);

    propertiesToAdd.forEach(property =>
      setPropertyValue(this._bpmnFactory, this._commandStack, element, property, property.value)
    );

    propertiesToRemove.forEach(property =>
      unsetProperty(this._commandStack, element, property)
    );
  }

  _updateReferencedElement(element, oldTemplate, newTemplate) {
    if (hasMessageProperties(oldTemplate) && !hasMessageProperties(newTemplate)) {
      removeMessage(element, this._injector);
    }
  }
}


ElementTemplatesConditionChecker.$inject = [
  'eventBus',
  'elementTemplates',
  'commandStack',
  'bpmnFactory',
  'injector'
];


// helpers

function getMissingProperties(sourceTemplate, targetTemplate) {

  let properties = targetTemplate.properties;

  return properties.filter(targetProp =>!(
    sourceTemplate.properties.find(sourceProp => compareProps(sourceProp, targetProp))
  ));
}

function compareProps(sourceProp, targetProp) {
  return (
    areBindingsEqual(sourceProp.binding, targetProp.binding) &&
    equals(sourceProp.condition, targetProp.condition)
  );
}

function findPropertyWithBinding(template, prop1) {
  return template.properties.some(
    prop2 => areBindingsEqual(prop1.binding, prop2.binding)
  );
}

function getPropertiesToRemove(newTemplate, oldTemplate) {
  const oldProperties = getMissingProperties(newTemplate, oldTemplate);

  // ensure XML properties are mantained for properties with
  // different conditions but same bindings
  return oldProperties.filter(property =>
    !findPropertyWithBinding(newTemplate, property)
  );
}

function normalizeReplacer(key, value) {

  if (isObject(value)) {
    const keys = Object.keys(value).sort();

    return keys.reduce((obj, key) => {
      obj[key] = value[key];

      return obj;
    }, {});
  }

  return value;
}

function areBindingsEqual(binding1, binding2) {
  binding1 = normalizeBinding(binding1);
  binding2 = normalizeBinding(binding2);

  return equals(binding1, binding2);
}

/**
 * Convert deprecated binding type to new type.
 */
function normalizeBinding(binding) {
  if (binding.type === ZEEBE_TASK_DEFINITION_TYPE_TYPE) {
    return {
      ...binding,
      type: ZEEBE_TASK_DEFINITION,
      property: 'type'
    };
  }

  return binding;
}

function equals(a, b) {
  return JSON.stringify(a, normalizeReplacer) === JSON.stringify(b, normalizeReplacer);
}

function hasMessageProperties(template) {
  return template.properties.some(p => MESSAGE_BINDING_TYPES.includes(p.binding.type));
}
