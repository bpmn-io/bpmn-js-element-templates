import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
import { is } from 'bpmn-js/lib/util/ModelUtil';

import { findExtension } from '../Helper';

/**
 * Enforces no variable propagation for templated call activities.
 */
export class CalledElementBehavior extends CommandInterceptor {

  /**
   * @param {*} eventBus
   * @param {*} modeling
   * @param {import('../ElementTemplates').default} elementTemplates
   */
  constructor(eventBus, modeling, elementTemplates) {
    super(eventBus);

    this._modeling = modeling;
    this._elementTemplates = elementTemplates;

    this.postExecuted([
      'element.updateProperties', 'element.updateModdleProperties'
    ], this._ensureNoPropagation, true, this);
  }

  _ensureNoPropagation(context) {
    const { element } = context;

    if (!this._elementTemplates.get(element)) {
      return;
    }

    if (!is(element, 'bpmn:CallActivity')) {
      return;
    }

    const calledElement = findExtension(element, 'zeebe:CalledElement');

    if (!calledElement) {
      return;
    }

    for (const property of [
      'propagateAllChildVariables',
      'propagateAllParentVariables'
    ]) {
      if (calledElement.get(property) !== false) {
        this._modeling.updateModdleProperties(element, calledElement, {
          [property]: false
        });
      }
    }
  }
}

CalledElementBehavior.$inject = [
  'eventBus',
  'modeling',
  'elementTemplates'
];
