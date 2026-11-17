const COMMAND = 'element-templates.migrate';
const registered = new WeakSet();

/**
 * diagram-js groups nested commands, but does not roll them back on exceptions.
 * Keep its history and execution checkpoint so a failed preExecute can be
 * unwound before the error reaches the caller. Never start within another group.
 */
export function executeMigration(commandStack, apply) {
  const execution = commandStack._currentExecution;
  if (execution.actions.length) {
    throw new Error('A migration must start outside command execution.');
  }
  if (!registered.has(commandStack)) {
    commandStack.register(COMMAND, {
      preExecute(context) {
        context.result = context.apply();
      }
    });
    registered.add(commandStack);
  }
  const stack = commandStack._stack.slice();
  const index = commandStack._stackIdx;
  const checkpoint = {
    ...execution,
    actions: execution.actions.slice(),
    dirty: execution.dirty.slice()
  };
  const context = {
    apply
  };
  try {
    commandStack.execute('element-templates.multi-command-executor', [ {
      cmd: COMMAND,
      context
    } ]);
    return context.result;
  } catch (error) {

    // A thrown nested command can leave active actions on the execution stack.
    execution.actions = [];
    execution.atomic = false;
    try {
      if (commandStack._stackIdx > index) commandStack.undo();
    } finally {
      commandStack._stack = stack;
      commandStack._stackIdx = index;
      Object.assign(execution, checkpoint);
    }
    throw error;
  }
}
