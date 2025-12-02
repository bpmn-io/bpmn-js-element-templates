import CoreModule from 'bpmn-js/lib/core';
import ModelingModule from 'bpmn-js/lib/features/modeling';
import ReplaceModule from 'bpmn-js/lib/features/replace';
import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import {
  bootstrapModeler,
  inject
} from '../../../TestHelper';

import { BpmnPropertiesPanelModule as BpmnPropertiesPanel } from 'bpmn-js-properties-panel';
import { BpmnPropertiesProviderModule as BpmnPropertiesProvider } from 'bpmn-js-properties-panel';
import ElementTemplatesModule from 'src/cloud-element-templates';

import diagramXML from './TimerTemplateBehavior.bpmn';
import templates from './TimerTemplateBehavior.json';


describe('provider/cloud-element-templates - TimerTemplateBehavior', function() {

  const testModules = [
    BpmnPropertiesPanel,
    BpmnPropertiesProvider,
    CoreModule,
    ElementTemplatesModule,
    ModelingModule,
    ReplaceModule
  ];

  beforeEach(bootstrapModeler(diagramXML, {
    elementTemplates: templates,
    modules: testModules,
    moddleExtensions: { zeebe: zeebeModdlePackage }
  }));


  describe('boundary events', function() {

    it('should unlink timeCycle template when boundary event made interrupting', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('NonInterruptingTimerCycleBoundary');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-boundary-template');
        expect(bo.get('cancelActivity')).to.equal(false);

        // when
        modeling.updateProperties(event, { cancelActivity: true });

        // then - timeCycle is NOT valid for interrupting boundary events, so template should be unlinked
        expect(bo.get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep timeDuration template when boundary event made interrupting', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('NonInterruptingTimerDurationBoundary');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-boundary-template');
        expect(bo.get('cancelActivity')).to.equal(false);

        // when
        modeling.updateProperties(event, { cancelActivity: true });

        // then - template should still be linked (timeDuration is valid for interrupting)
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-boundary-template');
      }
    ));

  });


  describe('event subprocess start events', function() {

    it('should unlink timeCycle template when event subprocess start made interrupting', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('NonInterruptingEventSubProcessStart');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-subprocess-start-template');
        expect(bo.get('isInterrupting')).to.equal(false);

        // when
        modeling.updateProperties(event, { isInterrupting: true });

        // then
        expect(bo.get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep timeDuration template when event subprocess start made interrupting', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('NonInterruptingDurationEventSubProcessStart');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');
        expect(bo.get('isInterrupting')).to.equal(false);

        // when
        modeling.updateProperties(event, { isInterrupting: true });

        // then - template should still be linked (timeDuration is valid for interrupting)
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');
      }
    ));

  });


  describe('move events', function() {

    it('should unlink timeDuration template when start event moved from event subprocess to root process', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('NonInterruptingDurationEventSubProcessStart');
        const bo = getBusinessObject(event);
        const rootProcess = elementRegistry.get('Process_1');

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');

        // when - move to root process
        modeling.moveElements([ event ], { x: 0, y: -200 }, rootProcess);

        // then - template should be unlinked (timeDuration is not valid for process-level start)
        expect(bo.get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should unlink timeCycle template when start event moved to event subprocess (becomes interrupting)', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('TimerCycleStartInRoot');
        const bo = getBusinessObject(event);
        const eventSubprocess = elementRegistry.get('EventSubProcess_3');

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-start-template');

        // when - move to event subprocess (will become interrupting by default)
        modeling.moveElements([ event ], { x: 600, y: 200 }, eventSubprocess);

        // then - template should be unlinked (timeCycle is not valid for interrupting event subprocess start)
        expect(bo.get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep timeCycle template when start event moved within root process', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('TimerCycleStartInRoot');
        const bo = getBusinessObject(event);
        const rootProcess = elementRegistry.get('Process_1');

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-start-template');

        // when - move within root process
        modeling.moveElements([ event ], { x: 50, y: 50 }, rootProcess);

        // then - template should remain linked
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-start-template');
      }
    ));


    it('should keep timeDuration template when start event moved within event subprocess', inject(
      function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('NonInterruptingDurationEventSubProcessStart');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');

        // when - move within same event subprocess
        modeling.moveElements([ event ], { x: 50, y: 0 });

        // then - template should remain linked
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');
      }
    ));

  });


  describe('copy paste', function() {

    it('should unlink timeDuration template when pasting start event from event subprocess to root', inject(
      function(elementRegistry, copyPaste, canvas) {

        // given
        const event = elementRegistry.get('NonInterruptingDurationEventSubProcessStart');
        const root = canvas.getRootElement();

        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: root,
          point: { x: 500, y: 100 }
        });

        // then - template should be unlinked
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep timeDuration template when pasting start event in event subprocess', inject(
      function(elementRegistry, copyPaste) {

        // given
        const event = elementRegistry.get('NonInterruptingDurationEventSubProcessStart');
        const eventSubprocess = elementRegistry.get('EventSubProcess_3');

        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: eventSubprocess,
          point: { x: 700, y: 260 }
        });

        // then - template should remain linked
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).to.equal('timer-duration-subprocess-start-template');
      }
    ));


    it('should unlink timeCycle template when pasting start event to event subprocess (becomes interrupting)', inject(
      function(elementRegistry, copyPaste) {

        // given
        const event = elementRegistry.get('TimerCycleStartInRoot');
        const eventSubprocess = elementRegistry.get('EventSubProcess_3');

        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('timer-cycle-start-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: eventSubprocess,
          point: { x: 700, y: 260 }
        });

        // then - template should be unlinked (timeCycle not valid for interrupting event subprocess start)
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep timeCycle template when pasting start event in root process', inject(
      function(elementRegistry, copyPaste, canvas) {

        // given
        const event = elementRegistry.get('TimerCycleStartInRoot');
        const root = canvas.getRootElement();

        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('timer-cycle-start-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: root,
          point: { x: 500, y: 100 }
        });

        // then - template should remain linked
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).to.equal('timer-cycle-start-template');
      }
    ));

  });


  describe('undo/redo', function() {

    it('should undo auto-conversion to non-interrupting when applying timeCycle template', inject(
      function(elementRegistry, elementTemplates, commandStack) {

        // given - interrupting boundary event
        const event = elementRegistry.get('InterruptingBoundaryEvent');
        const originalBo = getBusinessObject(event);

        expect(originalBo.get('cancelActivity')).not.to.equal(false);
        expect(originalBo.get('zeebe:modelerTemplate')).not.to.exist;

        // when - apply timeCycle template (auto-converts to non-interrupting)
        const template = elementTemplates.get('timer-cycle-boundary-template', 1);
        const updatedEvent = elementTemplates.applyTemplate(event, template);
        const updatedBo = getBusinessObject(updatedEvent);

        expect(updatedBo.get('cancelActivity')).to.equal(false);
        expect(updatedBo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-boundary-template');

        // when - undo
        commandStack.undo();

        // then - should be back to interrupting and no template
        // After undo, the original element should be restored
        const restoredEvent = elementRegistry.get('InterruptingBoundaryEvent');
        const restoredBo = getBusinessObject(restoredEvent);
        expect(restoredBo.get('cancelActivity')).not.to.equal(false);
        expect(restoredBo.get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should redo auto-conversion to non-interrupting when applying timeCycle template', inject(
      function(elementRegistry, elementTemplates, commandStack) {

        // given - interrupting boundary event
        const event = elementRegistry.get('InterruptingBoundaryEvent');

        // apply template and undo
        const template = elementTemplates.get('timer-cycle-boundary-template', 1);
        elementTemplates.applyTemplate(event, template);
        commandStack.undo();

        const afterUndoEvent = elementRegistry.get('InterruptingBoundaryEvent');
        const afterUndoBo = getBusinessObject(afterUndoEvent);
        expect(afterUndoBo.get('cancelActivity')).not.to.equal(false);
        expect(afterUndoBo.get('zeebe:modelerTemplate')).not.to.exist;

        // when - redo
        commandStack.redo();

        // then - should be non-interrupting with template again
        const afterRedoEvent = elementRegistry.get('InterruptingBoundaryEvent');
        const afterRedoBo = getBusinessObject(afterRedoEvent);
        expect(afterRedoBo.get('cancelActivity')).to.equal(false);
        expect(afterRedoBo.get('zeebe:modelerTemplate')).to.equal('timer-cycle-boundary-template');
      }
    ));


    it('should undo unlink when moving timer duration start event to root', inject(
      function(elementRegistry, modeling, canvas, commandStack) {

        // given - timer duration start event in event subprocess
        const event = elementRegistry.get('EventSubProcessTimerDurationStart');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-start-template');

        // when - move to root process (should unlink)
        const rootProcess = canvas.getRootElement();
        modeling.moveElements([ event ], { x: 0, y: -200 }, rootProcess);

        expect(bo.get('zeebe:modelerTemplate')).not.to.exist;

        // when - undo
        commandStack.undo();

        // then - should be back in event subprocess with template
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-start-template');
      }
    ));


    it('should undo unlink when changing cancelActivity on boundary event', inject(
      function(elementRegistry, modeling, commandStack) {

        // given - non-interrupting boundary event with timeDuration template
        const event = elementRegistry.get('NonInterruptingTimerDurationBoundary');
        const bo = getBusinessObject(event);

        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-boundary-template');
        expect(bo.get('cancelActivity')).to.equal(false);

        // when - make interrupting (template should stay for timeDuration)
        modeling.updateProperties(event, { cancelActivity: true });

        // timeDuration is valid for both interrupting and non-interrupting
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-boundary-template');

        // when - undo
        commandStack.undo();

        // then - should be back to non-interrupting with template
        expect(bo.get('cancelActivity')).to.equal(false);
        expect(bo.get('zeebe:modelerTemplate')).to.equal('timer-duration-boundary-template');
      }
    ));

  });

});