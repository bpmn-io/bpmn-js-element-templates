import { getBusinessObject, is, isAny } from 'bpmn-js/lib/util/ModelUtil';

import { TIMER_EVENT_DEFINITION_PROPERTY_TYPE } from './bindingTypes';

/**
 * Check whether a given timer expression type is supported for a given element.
 *
 * @param {string} type - 'timeDate', 'timeCycle', or 'timeDuration'
 * @param {Element} element
 * @return {boolean}
 */
export function isTimerExpressionTypeSupported(type, element) {
  const businessObject = getBusinessObject(element);

  switch (type) {
  case 'timeDate':
    return isAny(element, [
      'bpmn:BoundaryEvent',
      'bpmn:IntermediateCatchEvent',
      'bpmn:StartEvent'
    ]);

  case 'timeCycle':

    if (is(element, 'bpmn:StartEvent') && (!hasParentEventSubProcess(businessObject) || !isInterrupting(businessObject))) {
      return true;
    }

    if (is(element, 'bpmn:BoundaryEvent') && !isInterrupting(businessObject)) {
      return true;
    }

    return false;

  case 'timeDuration':
    if (isAny(element, [
      'bpmn:BoundaryEvent',
      'bpmn:IntermediateCatchEvent'
    ])) {
      return true;
    }

    if (is(element, 'bpmn:StartEvent') && hasParentEventSubProcess(businessObject)) {
      return true;
    }

    return false;

  default:
    return false;
  }
}

/**
 * Check if the template is a timer template and if so, whether it is applicable
 *
 * @param {Object} template
 * @param {Element} element
 * @return {boolean}
 */
export function isTimerTemplateApplicable(template, element) {

  // Find timer binding in template
  const timerBinding = template.properties?.find(property => {
    return property.binding?.type === TIMER_EVENT_DEFINITION_PROPERTY_TYPE;
  });

  // No timer binding - template is applicable
  if (!timerBinding) {
    return true;
  }

  const timerType = timerBinding.binding.name;

  // Check if the timer type can be applied (possibly with auto-conversion)
  return canTimerTypeBeAppliedWithConversion(timerType, element);
}

/**
 * Check if a timer type can be applied to an element, possibly with auto-conversion.
 *
 * Only blocks truly impossible combinations:
 * - timeDuration on process-level start events (can't be converted)
 *
 * @param {string} type - 'timeDate', 'timeCycle', or 'timeDuration'
 * @param {Element} element
 * @return {boolean}
 */
function canTimerTypeBeAppliedWithConversion(type, element) {
  const businessObject = getBusinessObject(element);

  switch (type) {
  case 'timeDate':
    return isAny(element, [
      'bpmn:BoundaryEvent',
      'bpmn:IntermediateCatchEvent',
      'bpmn:StartEvent'
    ]);

  case 'timeCycle':

    if (isAny(element, [ 'bpmn:StartEvent', 'bpmn:BoundaryEvent' ])) {
      return true;
    }

    return false;

  case 'timeDuration':
    if (isAny(element, [
      'bpmn:BoundaryEvent',
      'bpmn:IntermediateCatchEvent'
    ])) {
      return true;
    }

    // timeDuration can only be applied to start events in event subprocesses
    // Process-level start events cannot support timeDuration (no conversion possible)
    if (is(element, 'bpmn:StartEvent') && hasParentEventSubProcess(businessObject)) {
      return true;
    }

    return false;

  default:
    return false;
  }
}

// helpers //////////

function isInterrupting(businessObject) {
  if (is(businessObject, 'bpmn:BoundaryEvent')) {
    return businessObject.get('cancelActivity') !== false;
  }

  return businessObject.get('isInterrupting') !== false;
}

function hasParentEventSubProcess(businessObject) {
  const parent = businessObject.$parent;

  return parent && is(parent, 'bpmn:SubProcess') && parent.get('triggeredByEvent');
}
