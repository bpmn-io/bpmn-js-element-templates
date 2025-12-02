import ChangeElementTemplateHandler from './ChangeElementTemplateHandler';
import RemoveElementTemplateHandler from './RemoveElementTemplateHandler';
import UnlinkElementTemplateHandler from './UnlinkElementTemplateHandler';
import MultiCommandHandler from './MultiCommandHandler';

export default class ElementTemplatesCommands {
  constructor(commandStack, elementTemplates, eventBus) {
    commandStack.registerHandler(
      'element-templates.multi-command-executor',
      MultiCommandHandler
    );

    commandStack.registerHandler(
      'propertiesPanel.camunda.changeTemplate',
      ChangeElementTemplateHandler
    );

    commandStack.registerHandler(
      'propertiesPanel.removeTemplate',
      RemoveElementTemplateHandler
    );

    commandStack.registerHandler(
      'propertiesPanel.unlinkTemplate',
      UnlinkElementTemplateHandler
    );

    // apply default element templates on shape creation
    eventBus.on([ 'commandStack.shape.create.postExecuted' ], function(event) {
      const {
        context: {
          hints = {},
          shape
        }
      } = event;

      if (hints.createElementsBehavior !== false) {
        applyDefaultTemplate(shape, elementTemplates, commandStack);
      }
    });

    // apply default element templates on connection creation
    eventBus.on([ 'commandStack.connection.create.postExecuted' ], function(event) {
      const {
        context: {
          hints = {},
          connection
        }
      } = event;

      if (hints.createElementsBehavior !== false) {
        applyDefaultTemplate(connection, elementTemplates, commandStack);
      }
    });
  }
}

ElementTemplatesCommands.$inject = [ 'commandStack', 'elementTemplates', 'eventBus' ];

function applyDefaultTemplate(element, elementTemplates, commandStack) {

  if (!elementTemplates.get(element) && elementTemplates.getDefault(element)) {

    const command = 'propertiesPanel.camunda.changeTemplate';
    const commandContext = {
      element: element,
      newTemplate: elementTemplates.getDefault(element)
    };

    commandStack.execute(command, commandContext);
  }
}
