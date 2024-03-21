import { forEach } from 'min-dash';


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
    openByDefault = true,
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
      isEdited: isFeelEntryEdited,
      property
    };
  }

  if (type === 'Number') {
    return {
      id,
      component: NumberProperty,
      isEdited: isNumberFieldEntryEdited,
      property
    };
  }

  if (type === 'Boolean') {
    return {
      id,
      component: BooleanProperty,
      isEdited: isCheckboxEntryEdited,
      property
    };
  }

  if (type === 'Dropdown') {
    return {
      id,
      component: DropdownProperty,
      isEdited: isSelectEntryEdited,
      property
    };
  }

  if (type === 'String') {
    if (feel) {
      return {
        id,
        component: FeelProperty,
        isEdited: isFeelEntryEdited,
        property
      };
    }
    return {
      id,
      component: StringProperty,
      isEdited: isTextFieldEntryEdited,
      property
    };
  }

  if (type === 'Text') {
    if (feel) {
      return {
        id,
        component: FeelTextAreaProperty,
        isEdited: isFeelEntryEdited,
        property
      };
    }
    return {
      id,
      component: TextAreaProperty,
      isEdited: isTextAreaEntryEdited,
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


