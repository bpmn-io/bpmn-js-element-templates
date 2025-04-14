import {
  ensureExtension,
} from '../CreateHelper';

export default class ZeebeUserTaskBindingProvider {
  static create(element, options) {
    const {
      bpmnFactory
    } = options;

    ensureExtension(element, 'zeebe:UserTask', bpmnFactory);
  }
}