import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import { createElement } from '../../utils/ElementUtil';

import {
  ensureExtension
} from '../CreateHelper';
import { getDefaultValue } from '../Helper';


export default class LinkedResourcePropertyBindingProvider {
  static create(element, options) {
    const {
      property,
      bpmnFactory
    } = options;

    const {
      binding: {
        property: bindingProperty,
        linkName
      }
    } = property;

    const value = getDefaultValue(property);

    const bo = getBusinessObject(element);
    const linkedResources = ensureExtension(element, 'zeebe:LinkedResources', bpmnFactory);

    let linkedResource = linkedResources.get('values').find(linkedResource => linkedResource.get('linkName') === linkName);

    if (!linkedResource) {
      linkedResource = createElement('zeebe:LinkedResource', { linkName }, bo, bpmnFactory);
      linkedResources.get('values').push(linkedResource);
    }

    linkedResource.set(bindingProperty, value);
  }
}
