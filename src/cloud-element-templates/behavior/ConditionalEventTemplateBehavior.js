import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

import { CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY } from '../util/bindingTypes';
import { findConditionalEventDefinition } from '../Helper';

/**
 * This behavior monitors changes to conditional events and unlinks templates
 * when constraints are violated:
 *
 * - `variableEvents` property of `bpmn:ConditionalEventDefinition` is not supported
 * for root-level events (direct children of bpmn:Process)
 */
export default class ConditionalEventTemplateBehavior extends CommandInterceptor {
  constructor(eventBus, elementTemplates) {
    super(eventBus);

    this._elementTemplates = elementTemplates;

    // Validate on property changes - e.g. when template is applied or updated
    this.postExecuted([
      'element.updateProperties',
      'element.updateModdleProperties'
    ], ({ context }) => {
      const { element, properties } = context;

      const isRelevantPropertyChange =
        properties?.values?.some(v => v?.variableEvents !== undefined);

      if (!isRelevantPropertyChange) {
        return;
      }

      this._unlinkIfInvalidConditionalTemplate(element);
    });

    // Validate on shape move - element may have moved into a subprocess
    this.postExecuted('shape.move', context => {
      const element = context.shape;
      this._unlinkIfInvalidConditionalTemplate(element);
    }, true);

    // Validate on copy-paste - unlink templates that become invalid in the new context
    this.postExecuted('elements.create', context => {
      if (context.elements) {
        context.elements.forEach(el => this._unlinkIfInvalidConditionalTemplate(el));
      }
    }, true);
  }

  _unlinkIfInvalidConditionalTemplate(element) {
    if (!is(element, 'bpmn:Event')) {
      return;
    }

    const conditionalEventDefinition = findConditionalEventDefinition(element);

    if (!conditionalEventDefinition) {
      return;
    }

    const elementTemplates = this._elementTemplates;
    const template = elementTemplates.get(element);

    if (!template) {
      return;
    }

    const hasVariableEventsBinding = template.properties.some(property => {
      return property.binding?.type === CONDITIONAL_EVENT_DEFINITION_ZEEBE_CONDITIONAL_FILTER_PROPERTY &&
             property.binding?.name === 'variableEvents';
    });

    if (!hasVariableEventsBinding) {
      return;
    }

    if (
      isRootLevelEvent(element) &&
      !is(element, 'bpmn:IntermediateCatchEvent') &&
      !is(element, 'bpmn:BoundaryEvent')
    ) {
      elementTemplates.unlinkTemplate(element);
    }
  }
}

ConditionalEventTemplateBehavior.$inject = [
  'eventBus',
  'elementTemplates'
];


// helpers //////////

/**
 * Check if the element is a root-level event (direct child of bpmn:Process).
 *
 * @param {djs.model.Base} element
 * @returns {boolean}
 */
function isRootLevelEvent(element) {
  const businessObject = getBusinessObject(element);
  const parent = businessObject.$parent;

  return is(parent, 'bpmn:Process');
}
