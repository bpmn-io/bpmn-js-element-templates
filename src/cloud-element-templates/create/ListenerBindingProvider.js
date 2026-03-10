import {
  ensureExtension
} from '../CreateHelper';

import { getDefaultValue } from '../Helper';


export class ExecutionListenerBindingProvider {
  static create(element, options) {
    const {
      property,
      bpmnFactory
    } = options;

    createListener(element, property, bpmnFactory, {
      containerType: 'zeebe:ExecutionListeners',
      listenerType: 'zeebe:ExecutionListener'
    });
  }
}


export class TaskListenerBindingProvider {
  static create(element, options) {
    const {
      property,
      bpmnFactory
    } = options;

    createListener(element, property, bpmnFactory, {
      containerType: 'zeebe:TaskListeners',
      listenerType: 'zeebe:TaskListener'
    });
  }
}


// helpers //////////

function createListener(element, property, bpmnFactory, options) {
  const {
    containerType,
    listenerType
  } = options;

  const { binding } = property;
  const value = getDefaultValue(property);

  const listenersContainer = ensureExtension(element, containerType, bpmnFactory);

  const listenerProps = {
    eventType: binding.eventType,
    type: value,
    retries: binding.retries
  };

  const listener = bpmnFactory.create(listenerType, listenerProps);
  listener.$parent = listenersContainer;

  listenersContainer.get('listeners').push(listener);
}
