import { find, forEach, groupBy } from 'min-dash';

/**
 * Resolve the id of the custom property entry that renders the given template
 * property. This mirrors how `CustomProperties` groups properties into
 * (custom group | default group) buckets, and is the single source for the
 * `custom-entry-*` id scheme, shared by the properties panel (rendering) and
 * the element-templates lint rule (navigation).
 *
 * The grouping (`groupBy(properties, 'group')` + custom-group lookup) is kept
 * in sync with `custom-properties/util.js`; it is inlined here so this module
 * stays free of the properties panel's preact dependencies and can be used
 * from the headless lint rule.
 *
 * @param {Object} elementTemplate the applied template (conditions already applied)
 * @param {Object} property a property of that template
 *
 * @return {string|null} the entry id, or `null` if the property is not rendered
 */
export function getPropertyEntryId(elementTemplate, property) {
  const {
    id,
    properties,
    groups
  } = elementTemplate;

  const groupedProperties = groupBy(properties, 'group');

  const defaultProperties = [];

  let entryId = null;

  forEach(groupedProperties, (groupProperties, groupId) => {

    // already found
    if (entryId) {
      return;
    }

    // properties of an undefined group render in the default group
    const group = find(groups, group => group.id === groupId);

    if (!group) {
      defaultProperties.push(...groupProperties);

      return;
    }

    const index = groupProperties.indexOf(property);

    if (index !== -1) {
      entryId = `custom-entry-${id}-${groupId}-${index}`;
    }
  });

  if (entryId) {
    return entryId;
  }

  const defaultIndex = defaultProperties.indexOf(property);

  if (defaultIndex !== -1) {
    return `custom-entry-${id}-${defaultIndex}`;
  }

  return null;
}
