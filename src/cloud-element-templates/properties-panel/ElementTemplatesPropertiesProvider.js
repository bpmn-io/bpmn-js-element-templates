import {
  createElementTemplatesGroup,
  TemplateProps
} from '../../components';

import {
  CustomProperties,
  MessageProps,
  SignalProps
} from './properties';

import { getTemplateId, getTemplateVersion } from '../Helper';

import { applyConditions } from '../Condition';
import { getPropertyValue } from '../util/propertyUtil';

const LOWER_PRIORITY = 300;

const ALWAYS_VISIBLE_GROUPS = [
  'general',
  'documentation',
  'multiInstance',
  'Zeebe__ExecutionListeners'
];


export default class ElementTemplatesPropertiesProvider {

  constructor(elementTemplates, propertiesPanel, injector) {
    propertiesPanel.registerProvider(LOWER_PRIORITY, this);

    this._elementTemplates = elementTemplates;
    this._injector = injector;
  }

  getGroups(element) {
    return (groups) => {
      const injector = this._injector;

      updateMessageGroup(groups, element);
      updateSignalGroup(groups, element);

      if (!this._shouldShowTemplateProperties(element)) {
        return groups;
      }

      const translate = injector.get('translate');

      // (0) Copy provided groups
      groups = groups.slice();

      const templatesGroup = {
        element,
        id: 'ElementTemplates__Template',
        label: translate('Template'),
        component: createElementTemplatesGroup({
          getTemplateId
        }),
        entries: TemplateProps({
          element,
          elementTemplates: this._elementTemplates,
          getTemplateId,
          getTemplateVersion
        })
      };

      // (1) Add templates group
      addGroupsAfter('documentation', groups, [ templatesGroup ]);

      let elementTemplate = this._elementTemplates.get(element);

      if (elementTemplate) {
        elementTemplate = applyConditions(element, elementTemplate, getPropertyValue);

        const templateSpecificGroups = [].concat(
          CustomProperties({ element, elementTemplate, injector })
        );

        // (2) add template-specific properties groups
        addGroupsAfter('ElementTemplates__Template', groups, templateSpecificGroups);
      }

      // (3) apply entries visible
      if (getTemplateId(element)) {
        groups = getVisibleGroups(elementTemplate || {}, groups);
      }

      return groups;
    };
  }

  _shouldShowTemplateProperties(element) {
    return getTemplateId(element) || this._elementTemplates.getAll(element).length;
  }
}

ElementTemplatesPropertiesProvider.$inject = [
  'elementTemplates',
  'propertiesPanel',
  'injector'
];


// helper /////////////////////

function updateMessageGroup(groups, element) {
  const messageGroup = findGroup(groups, 'message');

  if (!messageGroup) {
    return;
  }

  messageGroup.entries = overrideGenericEntries(
    messageGroup.entries,
    MessageProps({ element })
  );
}

function updateSignalGroup(groups, element) {
  const signalGroup = findGroup(groups, 'signal');

  if (!signalGroup) {
    return;
  }

  signalGroup.entries = overrideGenericEntries(
    signalGroup.entries,
    SignalProps({ element })
  );
}

function findGroup(groups, id) {
  return groups.find(g => g.id === id);
}

function overrideGenericEntries(oldEntries, newEntries) {
  return oldEntries.map(oldEntry => (
    newEntries.find(newEntry => newEntry.id === oldEntry.id) || oldEntry
  ));
}

/**
 *
 * @param {string|string[]} idOrIds
 * @param {Array<{ id: string }} groups
 * @param {Array<{ id: string }>} groupsToAdd
 */
function addGroupsAfter(idOrIds, groups, groupsToAdd) {
  let ids = idOrIds;
  if (!Array.isArray(idOrIds)) {
    ids = [ idOrIds ];
  }

  // find index of last group with provided id
  const index = groups.reduce((acc, group, index) => {
    return ids.includes(group.id) ? index : acc;
  }, -1);

  if (index !== -1) {
    groups.splice(index + 1, 0, ...groupsToAdd);
  } else {

    // add in the beginning if group with provided id is missing
    groups.unshift(...groupsToAdd);
  }
}

function getVisibleGroups(template, groups) {
  if (!template.entriesVisible) {
    return groups.filter(group => {
      return (
        ALWAYS_VISIBLE_GROUPS.includes(group.id) ||
        group.id.startsWith('ElementTemplates__')
      );
    });
  }

  return groups;
}
