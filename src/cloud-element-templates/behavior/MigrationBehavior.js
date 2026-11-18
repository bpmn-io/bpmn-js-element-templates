import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { applyConditions } from '../Condition';

import {
  findMigrationProperty,
  getMigrationSteps,
  resolveMigrationSteps
} from '../util/migrationUtil';

import { setPropertyValue } from '../util/propertyUtil';


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

      if (!migratedValues.length) {
        return;
      }

      const template = elementTemplates.get(element);

      migratedValues.forEach(({ to, value, includeHidden }) => {

        // previous writes may activate conditional properties
        const property = findMigrationProperty(applyConditions(element, template).properties, to, includeHidden);

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

  if (!oldTemplate || !newTemplate) {
    return [];
  }

  return resolveMigrationSteps(element, getMigrationSteps(newTemplate, oldTemplate));
}
