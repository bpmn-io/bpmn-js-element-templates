import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { assign } from 'min-dash';

/**
 * Disable the default Camunda behavior for a newly created element
 * if it is a templated `<bpmn:UserTask>`.
 */
export default class UserTaskBehavior extends CommandInterceptor {
  constructor(eventBus, elementTemplates) {
    super(eventBus);

    this.preExecute('shape.create', function(event) {
      const {
        context: {
          shape,
          hints = {},
        }
      } = event;

      if (is(shape, 'bpmn:UserTask') && elementTemplates.get(shape)) {
        assign(hints, {
          createElementsBehavior: false
        });
      }
    });
  }
}

UserTaskBehavior.$inject = [
  'eventBus',
  'elementTemplates'
];
