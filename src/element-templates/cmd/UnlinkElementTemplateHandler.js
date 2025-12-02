export default class UnlinkElementTemplateHandler {
  constructor(commandStack) {
    this._commandStack = commandStack;
  }

  preExecute(context) {
    const {
      element,
      oldTemplate
    } = context;

    this._commandStack.execute('propertiesPanel.camunda.changeTemplate', {
      element,
      oldTemplate,
      newTemplate: null
    });
  }
}


UnlinkElementTemplateHandler.$inject = [ 'commandStack' ];