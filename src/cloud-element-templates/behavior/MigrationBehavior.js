import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { applyConditions } from '../Condition';

import {
  findMigrationProperty,
  isEmpty,
  isSameBinding,
  prepareMigration
} from '../util/migrationUtil';

import { applyPreset } from '../util/presetUtil';

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
        migratedValues = [],
        options = {}
      } = context;

      if (!migratedValues.length) {
        return;
      }

      const template = elementTemplates.get(element);
      const presetTemplate = applyPreset(template, options.presetId);
      const presetProperties = presetTemplate.properties.filter(property => property._presetValue);

      const applyMigrationValue = ({ to, value }) => {

        // previous writes may activate conditional properties
        const property = findMigrationProperty(applyConditions(element, template).properties, to);
        const presetProperty = findMigrationProperty(presetProperties, to);

        if (property && !presetProperty) {
          setPropertyValue(bpmnFactory, commandStack, element, property, value);
        }
      };

      migratedValues.forEach(applyMigrationValue);

      // Conditional template reapplication may restore an explicitly cleared default.
      migratedValues
        .filter(({ to, value }, index, values) => {
          return isEmpty(value) && !values.slice(index + 1).some(next => isSameBinding(to, next.to));
        })
        .forEach(applyMigrationValue);
    }, true);
  }
}

MigrationBehavior.$inject = [
  'eventBus',
  'bpmnFactory',
  'commandStack',
  'elementTemplates'
];
