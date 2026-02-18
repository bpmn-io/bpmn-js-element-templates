import CoreModule from 'bpmn-js/lib/core';
import { expect } from 'chai';

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

import diagramXML from './ConditionalEventTemplateBehavior.bpmn';
import templates from './ConditionalEventTemplateBehavior.json';


describe('provider/cloud-element-templates - ConditionalEventTemplateBehavior', function() {

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


  describe('apply template', function() {

    it('should unlink template with variableEvents on root-level', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('RootEvent');

        // when
        event = elementTemplates.applyTemplate(event, templates[0]);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep template without variableEvents on root-level', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('RootEvent');

        // when
        event = elementTemplates.applyTemplate(event, templates[1]);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-no-variable-events-template');
      }
    ));


    it('should keep template without variableEvents in subprocess', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');

        // when
        event = elementTemplates.applyTemplate(event, templates[1]);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-no-variable-events-template');
      }
    ));


    it('should keep template with variableEvents in root-level for intermediate catch event', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('Root_CatchEvent');

        // when
        event = elementTemplates.applyTemplate(event, templates[2]);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-catch-with-variable-events-template');
      }
    ));


    it('should keep template with variableEvents for boundary catch event', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('Boundary_Event');

        // when
        event = elementTemplates.applyTemplate(event, templates[3]);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-boundary-event-template');
      }
    ));
  });


  describe('move events', function() {

    it('should unlink template with variableEvents when event moved from subprocess to root', inject(
      function(elementRegistry, modeling, canvas, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[0]);

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');

        // when
        const rootProcess = canvas.getRootElement();
        modeling.moveElements([ event ], { x: 0, y: -200 }, rootProcess);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep template without variableEvents when event moved from subprocess to root', inject(
      function(elementRegistry, modeling, canvas, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[1]);

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-no-variable-events-template');

        // when
        const rootProcess = canvas.getRootElement();
        modeling.moveElements([ event ], { x: 0, y: -200 }, rootProcess);

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-no-variable-events-template');
      }
    ));


    it('should keep template with variableEvents when moved within subprocess', inject(
      function(elementRegistry, modeling, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[0]);

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');

        // when
        modeling.moveElements([ event ], { x: 50, y: 0 });

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');
      }
    ));


    it('should keep template with variableEvents when catch event moved to root', inject(
      function(elementRegistry, modeling, elementTemplates) {

        // given
        let event = elementRegistry.get('Root_CatchEvent');
        event = elementTemplates.applyTemplate(event, templates[2]);

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-catch-with-variable-events-template');

        // when
        modeling.moveElements([ event ], { x: 200, y: 0 });

        // then
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-catch-with-variable-events-template');
      }
    ));

  });


  describe('copy paste', function() {

    it('should unlink template with variableEvents when pasting from subprocess to root', inject(
      function(elementRegistry, copyPaste, canvas, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[0]);
        const root = canvas.getRootElement();

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: root,
          point: { x: 500, y: 100 }
        });

        // then
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).not.to.exist;
      }
    ));


    it('should keep template without variableEvents when pasting from subprocess to root', inject(
      function(elementRegistry, copyPaste, canvas, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[1]);
        const root = canvas.getRootElement();

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-no-variable-events-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: root,
          point: { x: 500, y: 100 }
        });

        // then
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).to.equal('conditional-no-variable-events-template');
      }
    ));


    it('should keep template with variableEvents when pasting within subprocess', inject(
      function(elementRegistry, copyPaste, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[0]);
        const targetSubprocess = elementRegistry.get('EventSubProcess_1');

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');

        // when
        copyPaste.copy(event);
        const [ pastedEvent ] = copyPaste.paste({
          element: targetSubprocess,
          point: { x: 380, y: 140 }
        });

        // then
        expect(getBusinessObject(pastedEvent).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');
      }
    ));

  });


  describe('undo/redo', function() {

    it('should undo unlink when moving conditional event with variableEvents to root', inject(
      function(elementRegistry, modeling, canvas, commandStack, elementTemplates) {

        // given
        let event = elementRegistry.get('Subprocess_Event');
        event = elementTemplates.applyTemplate(event, templates[0]);

        // assume
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');

        // when - move to root process (should unlink)
        const rootProcess = canvas.getRootElement();
        modeling.moveElements([ event ], { x: 0, y: -200 }, rootProcess);

        // assume - template should be unlinked
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).not.to.exist;

        // when - undo
        commandStack.undo();

        // then - should be back in subprocess with template
        expect(getBusinessObject(event).get('zeebe:modelerTemplate')).to.equal('conditional-with-variable-events-template');
      }
    ));

  });

});
