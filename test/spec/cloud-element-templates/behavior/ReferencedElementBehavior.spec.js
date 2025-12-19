import CoreModule from 'bpmn-js/lib/core';
import { expect } from 'chai';

import ModelingModule from 'bpmn-js/lib/features/modeling';
import ReplaceModule from 'bpmn-js/lib/features/replace';
import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import {
  bootstrapModeler,
  getBpmnJS,
  inject
} from '../../../TestHelper';

import { BpmnPropertiesPanelModule as BpmnPropertiesPanel } from 'bpmn-js-properties-panel';
import { BpmnPropertiesProviderModule as BpmnPropertiesProvider } from 'bpmn-js-properties-panel';
import ElementTemplatesModule from 'src/cloud-element-templates';
import { findMessage, findSignal, getTemplateId, TEMPLATE_ID_ATTR } from 'src/cloud-element-templates/Helper';


import diagramXML from './ReferencedElementBehavior.bpmn';
import templates from './ReferencedElementBehavior.json';


describe('provider/cloud-element-templates - ReferencedElementBehavior', function() {

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
    modules : testModules,
    moddleExtensions: { zeebe: zeebeModdlePackage }
  }));


  describe('apply template', function() {

    it('should create new message when template is applied', inject(
      function(elementRegistry, elementTemplates) {

        // given
        const event = elementRegistry.get('MessageEvent_2');
        const initialMessages = getMessages();

        // when
        elementTemplates.applyTemplate(event, templates.find(t => t.id === 'messageEventTemplate'));

        // then
        expect(getMessages()).to.have.lengthOf(initialMessages.length + 1);
      })
    );


    it('should create new message and remove old one when template is changed', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('MessageEvent');
        const initialMessages = getMessages();

        // when
        elementTemplates.applyTemplate(event, templates.find(t => t.id === 'anotherMessageEventTemplate'));

        // then
        expect(getMessages()).to.have.lengthOf(initialMessages.length);
        expect(findMessage(getBusinessObject(event)).get(TEMPLATE_ID_ATTR)).to.equal('anotherMessageEventTemplate');
      })
    );


    it('should create new signal when template is applied', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('SignalEvent_2');
        const initialSignals = getSignals();

        // when
        elementTemplates.applyTemplate(event, templates.find(t => t.id === 'signalEventTemplate'));

        // then
        expect(getSignals()).to.have.lengthOf(initialSignals.length + 1);
      })
    );


    it('should create new signal and remove old one when template is changed', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('SignalEvent');
        const initialSignals = getSignals();

        // when
        elementTemplates.applyTemplate(event, templates.find(t => t.id === 'anotherSignalEventTemplate'));

        // then
        expect(getSignals()).to.have.lengthOf(initialSignals.length);
        expect(findSignal(getBusinessObject(event)).get(TEMPLATE_ID_ATTR)).to.equal('anotherSignalEventTemplate');
      })
    );


    it('should remove message when new template has no message', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let event = elementRegistry.get('MessageEvent_2');
        event = elementTemplates.applyTemplate(event, templates.find(t => t.id === 'messageEventTemplate'));
        const initialMessages = getMessages();

        // when
        elementTemplates.applyTemplate(event, templates.find(t => t.id === 'blankIntermediateEvent'));

        // then
        expect(getMessages()).to.have.lengthOf(initialMessages.length - 1);
      })
    );


    it('should remove signal when new template has no signal', inject(
      function(elementRegistry, elementTemplates, bpmnReplace) {

        // given
        let event = elementRegistry.get('SignalEvent_2');
        event = elementTemplates.applyTemplate(event, templates.find(t => t.id === 'signalEventTemplate'));
        const initialSignals = getSignals();

        // when
        elementTemplates.applyTemplate(event, templates.find(t => t.id === 'blankIntermediateEvent'));

        // then
        expect(getSignals()).to.have.lengthOf(initialSignals.length - 1);
      })
    );

  });


  describe('unlink template', function() {

    it('should unlink templated message when template is unlinked', inject(
      function(elementRegistry, elementTemplates) {

        // given
        const event = elementRegistry.get('MessageEvent');
        const initialMessages = getMessages();

        // when
        elementTemplates.unlinkTemplate(event);

        // then
        const eventBo = getBusinessObject(event);

        expect(eventBo.modelerTemplate).not.to.exist;
        expect(eventBo.modelerTemplateVersion).not.to.exist;
        expect(eventBo.name).to.equal('Event');

        const eventDefinitions = eventBo.get('eventDefinitions');
        expect(eventDefinitions).to.have.length(1);

        const message = eventDefinitions[0].get('messageRef');
        expect(message).to.exist;
        expect(message.get(TEMPLATE_ID_ATTR)).not.to.exist;

        expect(getMessages()).to.have.lengthOf(initialMessages.length);
      })
    );


    it('should unlink templated signal when template is unlinked', inject(
      function(elementRegistry, elementTemplates) {

        // given
        const event = elementRegistry.get('SignalEvent');
        const initialSignals = getSignals();

        // when
        elementTemplates.unlinkTemplate(event);

        // then
        const eventBo = getBusinessObject(event);

        expect(eventBo.modelerTemplate).not.to.exist;
        expect(eventBo.modelerTemplateVersion).not.to.exist;
        expect(eventBo.name).to.equal('Event');

        const eventDefinitions = eventBo.get('eventDefinitions');
        expect(eventDefinitions).to.have.length(1);

        const signal = eventDefinitions[0].get('signalRef');
        expect(signal).to.exist;
        expect(signal.get(TEMPLATE_ID_ATTR)).not.to.exist;

        expect(getSignals()).to.have.lengthOf(initialSignals.length);
      })
    );
  });


  describe('remove template', function() {

    it('should remove template message', inject(function(elementRegistry, elementTemplates) {

      // given
      let event = elementRegistry.get('MessageEvent'),
          eventBo = getBusinessObject(event);
      const initialMessages = getMessages();

      // when
      elementTemplates.removeTemplate(event);

      // then
      event = elementRegistry.get('MessageEvent');
      eventBo = getBusinessObject(event);

      expect(eventBo.modelerTemplate).not.to.exist;
      expect(eventBo.modelerTemplateVersion).not.to.exist;
      expect(eventBo.name).to.equal('Event');

      const eventDefinitions = eventBo.get('eventDefinitions');
      expect(eventDefinitions).to.have.length(1);

      const message = eventDefinitions[0].get('messageRef');
      expect(message).not.to.exist;

      expect(getMessages()).to.have.lengthOf(initialMessages.length - 1);
    }));


    it('should remove template signal', inject(function(elementRegistry, elementTemplates) {

      // given
      let event = elementRegistry.get('SignalEvent'),
          eventBo = getBusinessObject(event);
      const initialSignals = getSignals();

      // when
      elementTemplates.removeTemplate(event);

      // then
      event = elementRegistry.get('SignalEvent');
      eventBo = getBusinessObject(event);

      expect(eventBo.modelerTemplate).not.to.exist;
      expect(eventBo.modelerTemplateVersion).not.to.exist;
      expect(eventBo.name).to.equal('Event');

      const eventDefinitions = eventBo.get('eventDefinitions');
      expect(eventDefinitions).to.have.length(1);

      const signal = eventDefinitions[0].get('signalRef');
      expect(signal).not.to.exist;

      expect(getSignals()).to.have.lengthOf(initialSignals.length - 1);
    }));
  });


  describe('remove element', function() {

    it('should remove template message when element removed', inject(function(elementRegistry, modeling) {

      // given
      const event = elementRegistry.get('MessageEvent');
      const initialMessages = getMessages();

      // when
      modeling.removeShape(event);

      // then
      expect(elementRegistry.get('MessageEvent')).not.to.exist;

      expect(getMessages()).to.have.lengthOf(initialMessages.length - 1);
    }));


    it('should remove template signal when element removed', inject(function(elementRegistry, modeling) {

      // given
      const event = elementRegistry.get('SignalEvent');
      const initialSignals = getSignals();

      // when
      modeling.removeShape(event);

      // then
      expect(elementRegistry.get('SignalEvent')).not.to.exist;

      expect(getSignals()).to.have.lengthOf(initialSignals.length - 1);
    }));


    it('should NOT remove template message when label is removed',
      inject(function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('MessageEvent');
        const initialMessages = getMessages();

        // when
        modeling.removeShape(event.label);

        // then
        expect(elementRegistry.get('MessageEvent')).to.exist;
        expect(getMessages()).to.have.lengthOf(initialMessages.length);
      })
    );


    it('should NOT remove template signal when label is removed',
      inject(function(elementRegistry, modeling) {

        // given
        const event = elementRegistry.get('SignalEvent');
        const initialSignals = getSignals();

        // when
        modeling.removeShape(event.label);

        // then
        expect(elementRegistry.get('SignalEvent')).to.exist;
        expect(getSignals()).to.have.lengthOf(initialSignals.length);
      })
    );
  });


  describe('replace element', function() {

    it('should remove templated message when element replaced', inject(
      function(elementRegistry, bpmnReplace) {

        // given
        let event = elementRegistry.get('MessageEvent');
        const initialMessages = getMessages();

        // when
        bpmnReplace.replaceElement(event, {
          type: 'bpmn:IntermediateCatchEvent',
          eventDefinitionType: 'bpmn:TimerEventDefinition'
        });

        // then
        event = elementRegistry.get('MessageEvent');
        const eventBo = getBusinessObject(event);

        expect(eventBo.modelerTemplate).not.to.exist;
        expect(eventBo.modelerTemplateVersion).not.to.exist;
        expect(eventBo.name).to.equal('Event');

        const eventDefinitions = eventBo.get('eventDefinitions');
        expect(eventDefinitions).to.have.length(1);

        const message = eventDefinitions[0].get('messageRef');
        expect(message).not.to.exist;

        expect(getMessages()).to.have.lengthOf(initialMessages.length - 1);
      })
    );


    it('should remove templated signal when element replaced', inject(
      function(elementRegistry, bpmnReplace) {

        // given
        let event = elementRegistry.get('SignalEvent');
        const initialSignals = getSignals();

        // when
        bpmnReplace.replaceElement(event, {
          type: 'bpmn:IntermediateCatchEvent',
          eventDefinitionType: 'bpmn:TimerEventDefinition'
        });

        // then
        event = elementRegistry.get('SignalEvent');
        const eventBo = getBusinessObject(event);

        expect(eventBo.modelerTemplate).not.to.exist;
        expect(eventBo.modelerTemplateVersion).not.to.exist;
        expect(eventBo.name).to.equal('Event');

        const eventDefinitions = eventBo.get('eventDefinitions');
        expect(eventDefinitions).to.have.length(1);

        const signal = eventDefinitions[0].get('signalRef');
        expect(signal).not.to.exist;

        expect(getSignals()).to.have.lengthOf(initialSignals.length - 1);
      })
    );


    it('should remove old message when replacing message event with signal event', inject(
      function(elementRegistry, bpmnReplace) {

        // given
        let event = elementRegistry.get('MessageEvent');
        const initialMessagesCount = getMessages().length;
        const initialSignalsCount = getSignals().length;

        const messageBo = getBusinessObject(event);
        const messageEventDef = messageBo.get('eventDefinitions')[0];
        const oldMessage = messageEventDef.get('messageRef');

        // assume
        expect(oldMessage).to.exist;
        expect(oldMessage.get(TEMPLATE_ID_ATTR)).to.equal('messageEventTemplate');

        // when - replace message event with signal event
        event = bpmnReplace.replaceElement(event, {
          type: 'bpmn:IntermediateCatchEvent',
          eventDefinitionType: 'bpmn:SignalEventDefinition'
        });

        // then
        const eventBo = getBusinessObject(event);
        const eventDefinitions = eventBo.get('eventDefinitions');
        expect(eventDefinitions).to.have.length(1);

        const signalEventDef = eventDefinitions[0];
        expect(signalEventDef.$type).to.equal('bpmn:SignalEventDefinition');

        // old message should be removed
        const messageRef = signalEventDef.get('messageRef');
        expect(messageRef).not.to.exist;

        // signal reference should not exist (no template applied)
        const signalRef = signalEventDef.get('signalRef');
        expect(signalRef).not.to.exist;

        // old templated message should be removed from definitions
        expect(getMessages()).to.have.lengthOf(initialMessagesCount - 1);
        expect(getSignals()).to.have.lengthOf(initialSignalsCount);
      })
    );


    it('should remove old signal when replacing signal event with message event', inject(
      function(elementRegistry, bpmnReplace) {

        // given
        let event = elementRegistry.get('SignalEvent');
        const initialMessagesCount = getMessages().length;
        const initialSignalsCount = getSignals().length;

        const signalBo = getBusinessObject(event);
        const signalEventDef = signalBo.get('eventDefinitions')[0];
        const oldSignal = signalEventDef.get('signalRef');

        // assume
        expect(oldSignal).to.exist;
        expect(oldSignal.get(TEMPLATE_ID_ATTR)).to.equal('signalEventTemplate');

        // when - replace signal event with message event
        event = bpmnReplace.replaceElement(event, {
          type: 'bpmn:IntermediateCatchEvent',
          eventDefinitionType: 'bpmn:MessageEventDefinition'
        });

        // then
        const eventBo = getBusinessObject(event);
        const eventDefinitions = eventBo.get('eventDefinitions');
        expect(eventDefinitions).to.have.length(1);

        const messageEventDef = eventDefinitions[0];
        expect(messageEventDef.$type).to.equal('bpmn:MessageEventDefinition');

        // old signal should be removed
        const signalRef = messageEventDef.get('signalRef');
        expect(signalRef).not.to.exist;

        // message reference should not exist (no template applied)
        const messageRef = messageEventDef.get('messageRef');
        expect(messageRef).not.to.exist;

        // old templated signal should be removed from definitions
        expect(getSignals()).to.have.lengthOf(initialSignalsCount - 1);
        expect(getMessages()).to.have.lengthOf(initialMessagesCount);
      })
    );
  });


  describe('copy element', function() {

    it('should create new message when element copied', inject(
      function(elementRegistry, copyPaste, canvas) {

        // given
        const element = elementRegistry.get('MessageEvent');
        const copiedMessage = findMessage(getBusinessObject(element));
        const initialMessages = getMessages();

        // when
        copyPaste.copy([ element ]);

        const [ pastedShape ] = copyPaste.paste({
          element: canvas.getRootElement(),
          point: { x: 100, y: 100 }
        });
        const pastedMessage = findMessage(getBusinessObject(pastedShape));

        // then
        expect(getMessages()).to.have.lengthOf(initialMessages.length + 1);
        expect(pastedMessage).to.exist;
        expect(pastedMessage).not.to.eql(copiedMessage);
        expect(getTemplateId(pastedMessage)).to.equal(getTemplateId(copiedMessage));
      })
    );


    it('should create new signal when element copied', inject(
      function(elementRegistry, copyPaste, canvas) {

        // given
        const element = elementRegistry.get('SignalEvent');
        const copiedSignal = findSignal(getBusinessObject(element));
        const initialSignals = getSignals();

        // when
        copyPaste.copy([ element ]);

        const [ pastedShape ] = copyPaste.paste({
          element: canvas.getRootElement(),
          point: { x: 100, y: 100 }
        });
        const pastedSignal = findSignal(getBusinessObject(pastedShape));

        // then
        expect(getSignals()).to.have.lengthOf(initialSignals.length + 1);
        expect(pastedSignal).to.exist;
        expect(pastedSignal).not.to.eql(copiedSignal);
        expect(getTemplateId(pastedSignal)).to.equal(getTemplateId(copiedSignal));
      })
    );


    it('should NOT create new message when non-templated element copied', inject(
      function(elementRegistry, copyPaste, canvas) {

        // given
        const element = elementRegistry.get('MessageEvent_2');
        const copiedMessage = findMessage(getBusinessObject(element));
        const initialMessages = getMessages();

        // when
        copyPaste.copy([ element ]);

        const [ pastedShape ] = copyPaste.paste({
          element: canvas.getRootElement(),
          point: { x: 100, y: 100 }
        });
        const pastedMessage = findMessage(getBusinessObject(pastedShape));

        // then
        expect(getMessages()).to.have.lengthOf(initialMessages.length);
        expect(pastedMessage).to.eql(copiedMessage);
      })
    );


    it('should NOT create new signal when non-templated element copied', inject(
      function(elementRegistry, copyPaste, canvas) {

        // given
        const element = elementRegistry.get('SignalEvent_2');
        const copiedSignal = findSignal(getBusinessObject(element));
        const initialSignals = getSignals();

        // when
        copyPaste.copy([ element ]);

        const [ pastedShape ] = copyPaste.paste({
          element: canvas.getRootElement(),
          point: { x: 100, y: 100 }
        });
        const pastedSignal = findSignal(getBusinessObject(pastedShape));

        // then
        expect(getSignals()).to.have.lengthOf(initialSignals.length);
        expect(pastedSignal).to.eql(copiedSignal);
      })
    );
  });
});


// helper //////////////////////
function getMessages() {
  return getBpmnJS().getDefinitions().rootElements.filter(
    e => is(e, 'bpmn:Message'));
}

function getSignals() {
  return getBpmnJS().getDefinitions().rootElements.filter(
    e => is(e, 'bpmn:Signal'));
}