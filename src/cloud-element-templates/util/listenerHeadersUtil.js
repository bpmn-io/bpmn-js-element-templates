/**
 * Create zeebe:TaskHeaders with zeebe:Header children on a listener element
 * based on the template `binding.headers` definition.
 *
 * @param {ModdleElement} listener
 * @param {Array<{ key: string, value: string }>} headers
 * @param {BpmnFactory} bpmnFactory
 */
export function createListenerHeaders(listener, headers, bpmnFactory) {
  if (!headers || !headers.length) {
    return;
  }

  const taskHeaders = bpmnFactory.create('zeebe:TaskHeaders');
  taskHeaders.$parent = listener;

  headers.forEach(({ key, value }) => {
    const header = bpmnFactory.create('zeebe:Header', { key, value });
    header.$parent = taskHeaders;
    taskHeaders.get('values').push(header);
  });

  listener.set('headers', taskHeaders);
}
