import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { applyConditions } from '../Condition';

import {
  findEditableProperty,
  getMigration,
  mapValue
} from '../util/migrationUtil';

import {
  getPropertyValue,
  setPropertyValue
} from '../util/propertyUtil';


/**
 * Moves values as hinted by the new template's `migratesFrom`,
 * as part of the template change.
 */
export default class MigrationBehavior extends CommandInterceptor {

  constructor(eventBus, bpmnFactory, commandStack, elementTemplates) {
    super(eventBus);

    this.preExecute('propertiesPanel.zeebe.changeTemplate', (context) => {
      context.migratedValues = getMigratedValues(context);
    }, true);

    this.postExecute('propertiesPanel.zeebe.changeTemplate', (context) => {
      const {
        element,
        migratedValues = []
      } = context;

      migratedValues.forEach(({ binding, value }) => {
        const template = elementTemplates.get(element);

        // previous writes may activate conditional properties
        const property = findEditableProperty(applyConditions(element, template).properties, binding);

        if (property) {
          setPropertyValue(bpmnFactory, commandStack, element, property, value);
        }
      });
    }, true);
  }
}

MigrationBehavior.$inject = [
  'eventBus',
  'bpmnFactory',
  'commandStack',
  'elementTemplates'
];


function getMigratedValues(context) {
  const {
    element,
    oldTemplate,
    newTemplate
  } = context;

  const migration = oldTemplate && newTemplate && getMigration(newTemplate, oldTemplate.id);

  if (!migration) {
    return [];
  }

  return (migration.properties || []).flatMap(({ from, to, values }) => {
    const value = getPropertyValue(element, { type: 'String', binding: from });

    if (value === undefined || value === '') {
      return [];
    }

    return [ { binding: to, value: mapValue(value, values) } ];
  });
}
