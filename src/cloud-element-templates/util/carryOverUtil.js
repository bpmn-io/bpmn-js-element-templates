import { find } from 'min-dash';

import {
  CONDITIONAL_EVENT_DEFINITION_PROPERTY,
  CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY,
  MESSAGE_PROPERTY_TYPE,
  MESSAGE_ZEEBE_SUBSCRIPTION_PROPERTY_TYPE,
  SIGNAL_PROPERTY_TYPE,
  TASK_DEFINITION_TYPES,
  TIMER_EVENT_DEFINITION_PROPERTY_TYPE,
  ZEEBE_AD_HOC,
  ZEEBE_AGENT_DEFINITION,
  ZEEBE_ASSIGNMENT_DEFINITION,
  ZEEBE_CALLED_DECISION,
  ZEEBE_CALLED_ELEMENT,
  ZEEBE_FORM_DEFINITION,
  ZEEBE_JOB_PRIORITY_DEFINITION,
  ZEEBE_LINKED_RESOURCE_PROPERTY,
  ZEEBE_PRIORITY_DEFINITION,
  ZEEBE_SCRIPT_TASK,
  ZEEBE_TASK_SCHEDULE
} from './bindingTypes';

import { shouldCastToFeel, toFeelExpression } from './FeelUtil';

import { getTaskDefinitionPropertyName } from './taskDefinition';

/**
 * Rules that decide which values an element keeps when it changes its
 * template. Pure, so the core and static checks share them.
 */

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

  if (newBindingType === ZEEBE_CALLED_ELEMENT) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_CALLED_ELEMENT) {
        return;
      }

      return oldBindingType === newBindingType && oldBinding.property === newBinding.property;
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

  if (newBindingType === ZEEBE_JOB_PRIORITY_DEFINITION) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_JOB_PRIORITY_DEFINITION) {
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

  if (newBindingType === ZEEBE_AGENT_DEFINITION) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== ZEEBE_AGENT_DEFINITION) {
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

  if (newBindingType === TIMER_EVENT_DEFINITION_PROPERTY_TYPE) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== TIMER_EVENT_DEFINITION_PROPERTY_TYPE) {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }

  if (newBindingType === CONDITIONAL_EVENT_DEFINITION_PROPERTY) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== CONDITIONAL_EVENT_DEFINITION_PROPERTY) {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }

  if (newBindingType === CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY) {
    return oldProperties.find(oldProperty => {
      const oldBinding = oldProperty.binding,
            oldBindingType = oldBinding.type;

      if (oldBindingType !== CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY) {
        return;
      }

      return oldBinding.name === newBinding.name;
    });
  }
}


/**
 * Check whether a value set on an element is kept when the element changes
 * from the old to the new property. A value is kept if the user changed it
 * from the old template's default, unless the new property is `Hidden` or a
 * preset. `Dropdown` values are kept as long as they are a valid choice.
 *
 * @param {any} value
 * @param {Object} [oldProperty]
 * @param {Object} newProperty
 *
 * @returns {boolean}
 */
export function keepsValue(value, oldProperty, newProperty) {

  // preset values are authoritative and always (re-)applied
  if (newProperty._presetValue) {
    return false;
  }

  // "Hidden" values are treated as a constant
  if (newProperty.type === 'Hidden') {
    return false;
  }

  // Dropdowns should keep existing configuration
  // cf. https://github.com/bpmn-io/bpmn-js-properties-panel/issues/767
  if (newProperty.type === 'Dropdown') {
    return isChoice(newProperty, value);
  }

  // keep existing old property if
  // user changed it from the original
  if (oldProperty) {
    return value !== getDefaultFixedValue(oldProperty);
  }

  // moddle schema defaults (e.g. propagateAllParentVariables=true,
  // bindingType="latest") must not be treated as user data
  // cf. https://github.com/camunda/camunda-modeler/issues/6174
  return true;
}

/**
 * @param {Object} property
 * @param {any} value
 *
 * @returns {boolean}
 */
export function isChoice(property, value) {
  return !!property.choices && property.choices.some(choice => choice.value === value);
}

/**
 * Get the default value disregarding generated values.
 */
export function getDefaultFixedValue(property) {
  const value = getTemplateValue(property);

  if (
    shouldCastToFeel(property) || property.feel === 'required'
  ) {
    return toFeelExpression(value, property.type);
  }

  return value;
}

// a non-optional dropdown falls back to its first choice, like <select>
function getTemplateValue(property) {
  const {
    choices,
    optional,
    type,
    value
  } = property;

  if (value === undefined && type === 'Dropdown' && !optional && choices?.length) {
    return choices[ 0 ].value;
  }

  return value;
}
