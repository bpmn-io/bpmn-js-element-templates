import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { TIMER_EVENT_DEFINITION_PROPERTY_TYPE } from '../util/bindingTypes';
import { isTimerExpressionTypeSupported } from '../util/timerUtil';
import { findTimerEventDefinition } from '../Helper';

/**
 * This Behavior monitors changes to timer events and unlinks templates
 * when constraints are violated:
 * - timeCycle requires non-interrupting for boundary events (cancelActivity: false)
 * - timeCycle requires non-interrupting for event subprocess starts (isInterrupting: false)
 * - timeDuration is not valid for process-level start events
 */
export default class TimerTemplateBehavior extends CommandInterceptor {
  constructor(eventBus, elementTemplates) {
    super(eventBus);

    this._elementTemplates = elementTemplates;

    // Handle property changes - only react to cancelActivity/isInterrupting changes
    this.postExecuted([
      'element.updateProperties',
      'element.updateModdleProperties'
    ], this._handlePropertiesChange, true, this);

    // Handle shape move - element may have moved to a different context
    this.postExecuted('shape.move', context => {
      const element = context.shape;
      this._unlinkIfInvalidTimerTemplate(element);
    }, true);

    // Handle copy-paste: unlink templates that become invalid in the new context
    this.postExecuted('elements.create', context => {
      if (context.elements) {
        context.elements.forEach(el => this._unlinkIfInvalidTimerTemplate(el));
      }
    }, true);
  }

  _handlePropertiesChange(context) {
    const { element, properties } = context;

    const isRelevantPropertyChange = (
      properties && ('cancelActivity' in properties || 'isInterrupting' in properties)
    );

    if (!isRelevantPropertyChange) {
      return;
    }

    this._unlinkIfInvalidTimerTemplate(element);
  }

  _unlinkIfInvalidTimerTemplate(element) {
    if (!is(element, 'bpmn:Event')) {
      return;
    }

    const timerEventDefinition = findTimerEventDefinition(element);

    if (!timerEventDefinition) {
      return;
    }

    const elementTemplates = this._elementTemplates;
    const template = elementTemplates.get(element);

    if (!template) {
      return;
    }

    const timerBinding = template.properties.find(property => {
      return property.binding?.type === TIMER_EVENT_DEFINITION_PROPERTY_TYPE;
    });

    if (!timerBinding) {
      return;
    }

    const timerType = timerBinding.binding.name;

    if (!isTimerExpressionTypeSupported(timerType, element)) {
      elementTemplates.unlinkTemplate(element);
    }
  }
}

TimerTemplateBehavior.$inject = [
  'eventBus',
  'elementTemplates'
];
