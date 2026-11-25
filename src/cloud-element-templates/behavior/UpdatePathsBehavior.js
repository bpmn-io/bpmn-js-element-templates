import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { applyConditions } from '../Condition';

import {
  applyUpdateSteps,
  isSameBinding
} from '../util/updatePathsUtil';

import { getRawPropertyValue } from '../util/propertyUtil';


/**
 * Moves values as hinted by the new template's `updatePaths`, as part of the
 * template change: moved values are applied like preset values, so they win
 * over defaults, whatever activates their properties.
 */
export default class UpdatePathsBehavior extends CommandInterceptor {

  constructor(eventBus, elementTemplates) {
    super(eventBus);

    this.preExecute('propertiesPanel.zeebe.changeTemplate', (context) => {
      const {
        element,
        oldTemplate,
        newTemplate,
        options = {}
      } = context;

      // re-applications within the change carry the values already
      if (options._movedValues || !oldTemplate || !newTemplate) {
        return;
      }

      const steps = elementTemplates._getUpdateSteps(oldTemplate, newTemplate);

      // values of inactive properties are not user input
      const { properties } = applyConditions(element, oldTemplate);

      const movedValues = applyUpdateSteps(steps, binding => {
        if (properties.some(property => isSameBinding(property.binding, binding))) {
          return getRawPropertyValue(element, { binding });
        }
      });

      context.options = {
        ...options,
        _movedValues: movedValues
      };
    }, true);
  }
}

UpdatePathsBehavior.$inject = [
  'eventBus',
  'elementTemplates'
];
