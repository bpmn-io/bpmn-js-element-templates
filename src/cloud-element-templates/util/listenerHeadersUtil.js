import { createElement } from '../../utils/ElementUtil';

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

  const taskHeaders = createElement('zeebe:TaskHeaders', {}, listener, bpmnFactory);

  headers.forEach(({ key, value }) => {
    const header = createElement('zeebe:Header', { key, value }, taskHeaders, bpmnFactory);
    taskHeaders.get('values').push(header);
  });

  listener.set('headers', taskHeaders);
}
