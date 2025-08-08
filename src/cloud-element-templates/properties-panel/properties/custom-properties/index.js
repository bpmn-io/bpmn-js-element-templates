import { forEach } from 'min-dash';

import { getDefaultValue } from '../../../Helper';
import { PropertyTooltip } from '../../components/PropertyTooltip';

import {
  Group,
  isSelectEntryEdited,
  isCheckboxEntryEdited,
  isTextAreaEntryEdited,
  isTextFieldEntryEdited,
  isFeelEntryEdited,
  isNumberFieldEntryEdited
} from '@bpmn-io/properties-panel';

import {
  PROPERTY_TYPE,
  ZEEBE_TASK_DEFINITION_TYPE_TYPE,
  ZEEBE_TASK_DEFINITION,
  ZEBBE_INPUT_TYPE,
  ZEEBE_OUTPUT_TYPE,
  ZEEBE_PROPERTY_TYPE,
  ZEEBE_TASK_HEADER_TYPE
} from '../../../util/bindingTypes';

import { groupByGroupId, findCustomGroup } from './util';
import { getPropertyValue } from '../../../util/propertyUtil';
import { TextAreaProperty } from './TextAreaProperty';
import { StringProperty } from './StringProperty';
import { FeelProperty } from './FeelProperty';
import { FeelTextAreaProperty } from './FeelTextAreaProperty';
import { DropdownProperty } from './DropdownProperty';
import { BooleanProperty } from './BooleanProperty';
import { NumberProperty } from './NumberProperty';


export function CustomProperties(props) {
  const {
    element,
    elementTemplate,
    injector
  } = props;

  const translate = injector.get('translate');

  const groups = [];

  const {
    id,
    properties,
    groups: propertyGroups
  } = elementTemplate;

  // (1) group properties by group id
  const groupedProperties = groupByGroupId(properties);
  const defaultProps = [];

  forEach(groupedProperties, (properties, groupId) => {

    const group = findCustomGroup(propertyGroups, groupId);

    if (!group) {
      return defaultProps.push(...properties);
    }

    addCustomGroup(groups, {
      element,
      id: `ElementTemplates__CustomProperties-${groupId}`,
      label: translate(group.label),
      openByDefault: group.openByDefault,
      properties: properties,
      templateId: `${id}-${groupId}`,
      tooltip: PropertyTooltip({ tooltip: group.tooltip })
    });
  });

  // (2) add default custom props
  if (defaultProps.length) {
    addCustomGroup(groups, {
      id: 'ElementTemplates__CustomProperties',
      label: translate('Custom properties'),
      element,
      properties: defaultProps,
      templateId: id
    });
  }

  return groups;
}

function addCustomGroup(groups, props) {

  const {
    element,
    id,
    label,
    openByDefault = false,
    properties,
    templateId,
    tooltip
  } = props;

  const customPropertiesGroup = {
    id,
    label,
    component: Group,
    entries: [],
    shouldOpen: openByDefault,
    tooltip
  };

  properties.forEach((property, index) => {
    const entry = createCustomEntry(`custom-entry-${ templateId }-${ index }`, element, property);

    if (entry) {
      customPropertiesGroup.entries.push(entry);
    }
  });

  if (customPropertiesGroup.entries.length) {
    groups.push(customPropertiesGroup);
  }
}

function createCustomEntry(id, element, property) {
  let { type, feel } = property;

  if (!type) {
    type = getDefaultType(property);
  }

  if (feel === 'required') {
    return {
      id,
      component: FeelProperty,
      isEdited: createIsEdited(isFeelEntryEdited, element, property),
      property
    };
  }

  if (type === 'Number') {
    return {
      id,
      component: NumberProperty,
      isEdited: createIsEdited(isNumberFieldEntryEdited, element, property),
      property
    };
  }

  if (type === 'Boolean') {
    return {
      id,
      component: BooleanProperty,
      isEdited: createIsEdited(isCheckboxEntryEdited, element, property),
      property
    };
  }

  if (type === 'Dropdown') {
    return {
      id,
      component: DropdownProperty,
      isEdited: createIsEdited(isSelectEntryEdited, element, property),
      property
    };
  }

  if (type === 'String') {
    if (feel) {
      return {
        id,
        component: FeelProperty,
        isEdited: createIsEdited(isFeelEntryEdited, element, property),
        property
      };
    }
    return {
      id,
      component: StringProperty,
      isEdited: createIsEdited(isTextFieldEntryEdited, element, property),
      property
    };
  }

  if (type === 'Text') {
    if (feel) {
      return {
        id,
        component: FeelTextAreaProperty,
        isEdited: createIsEdited(isFeelEntryEdited, element, property),
        property
      };
    }
    return {
      id,
      component: TextAreaProperty,
      isEdited: createIsEdited(isTextAreaEntryEdited, element, property),
      property
    };
  }
}

function getDefaultType(property) {
  const { binding } = property;

  const { type } = binding;

  if ([
    PROPERTY_TYPE,
    ZEEBE_TASK_DEFINITION_TYPE_TYPE,
    ZEEBE_TASK_DEFINITION,
    ZEBBE_INPUT_TYPE,
    ZEEBE_OUTPUT_TYPE,
    ZEEBE_PROPERTY_TYPE,
    ZEEBE_TASK_HEADER_TYPE
  ].includes(type)) {
    return 'String';
  }
}

function createIsEdited(isEditedEntry, element, property) {

  if (property.generatedValue) return () => true;

  const actualValue = getPropertyValue(element, property);
  const defaultValue = getDefaultValue(property);

  return !isEmpty(defaultValue) ? () => actualValue !== defaultValue : isEditedEntry;
}

/**
 * Empty string is considered empty for input/output support.
 */
function isEmpty(value) {
  return value === undefined || value === '';
}
