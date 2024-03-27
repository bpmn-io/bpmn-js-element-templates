import {
  applyConditions
} from '../Condition';

import { isObject } from 'min-dash';
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { ZEEBE_TASK_DEFINITION, ZEEBE_TASK_DEFINITION_TYPE_TYPE } from '../util/bindingTypes';


/**
 * Checks the conditions of an element template and sets/resets the
 * corresponding properties on the element.
 */
export default class ConditionalBehavior extends CommandInterceptor {
  constructor(eventBus, elementTemplates, commandStack, bpmnFactory, injector) {
    super(eventBus);

    this._eventBus = eventBus;
    this._elementTemplates = elementTemplates;
    this._commandStack = commandStack;
    this._bpmnFactory = bpmnFactory;
    this._injector = injector;

    // (1) save pre-conditional state
    this.preExecute([
      'element.updateProperties',
      'element.updateModdleProperties',
      'element.move'
    ], this._saveConditionalState, true, this);

    // (2) so we can check if we need to apply post-conditional updates
    //
    //   if [additional bindings activate] then
    //     re-trigger setting the template
    //   else
    //     else we're done
    //
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

    context.oldTemplateWithConditions = applyConditions(element, template);
  }

  _applyConditions(context) {
    const {
      element
    } = context;

    const template = this._elementTemplates.get(element);

    // New Template is persisted before applying default values,
    // new conditions might apply after the defaults are present.
    const oldTemplate = context.oldTemplateWithConditions || context.newTemplate;

    if (!template || !oldTemplate || template.id !== oldTemplate.id) {
      return;
    }

    const newTemplate = applyConditions(element, template);

    // (3) this is the important check that verifies if we need to apply
    //     additional template properties
    if (!hasDifferentPropertyBindings(newTemplate, oldTemplate)) {
      return;
    }

    const changeContext = {
      element,
      newTemplate,
      oldTemplate
    };

    this._commandStack.execute('propertiesPanel.zeebe.changeTemplate', changeContext);
  }
}


ConditionalBehavior.$inject = [
  'eventBus',
  'elementTemplates',
  'commandStack',
  'bpmnFactory',
  'injector'
];


// helpers

function hasDifferentPropertyBindings(sourceTemplate, targetTemplate) {
  return hasNewProperties(sourceTemplate, targetTemplate) || hasRemovedProperties(sourceTemplate, targetTemplate);
}

function hasNewProperties(sourceTemplate, targetTemplate) {
  let properties = targetTemplate.properties;

  return properties.some(targetProp =>!(
    sourceTemplate.properties.find(sourceProp => compareProps(sourceProp, targetProp))
  ));
}

function hasRemovedProperties(oldTemplate, newTemplate) {
  const oldProperties = getMissingProperties(newTemplate, oldTemplate);

  // ensure XML properties are mantained for properties with
  // different conditions but same bindings
  return oldProperties.some(property =>
    !findPropertyWithBinding(newTemplate, property)
  );
}

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
