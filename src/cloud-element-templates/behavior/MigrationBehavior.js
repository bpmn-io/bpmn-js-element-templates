import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { applyConditions } from '../Condition';

import {
  findMigrationProperty,
  prepareMigration
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
      context.migratedValues ??= prepareMigration(context.element, context.oldTemplate, context.newTemplate);
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

      migratedValues.forEach(({ to, value }) => {

        // previous writes may activate conditional properties
        const property = findMigrationProperty(applyConditions(element, template).properties, to);

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
