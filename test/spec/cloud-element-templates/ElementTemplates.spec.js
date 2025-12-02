import TestContainer from 'mocha-test-container-support';

import {
  is,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import {
  bootstrapModeler,
  createCanvasEvent as canvasEvent,
  inject
} from 'test/TestHelper';

import {
  getBusinessObject
} from 'bpmn-js/lib/util/ModelUtil';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesCoreModule from 'src/cloud-element-templates/core';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import diagramXML from './ElementTemplates.bpmn';
import integrationXML from './fixtures/integration.bpmn';
import messageTemplates from './ElementTemplates.message-templates.json';
import enginesTemplates from './ElementTemplates.engines-templates.json';
import completionConditionTemplates from './fixtures/completion-condition.json';

import templates from './fixtures/simple';
import falsyVersionTemplate from './fixtures/falsy-version';
import complexTemplates from './fixtures/complex';
import integrationTemplates from './fixtures/integration';
import { findExtensions, findExtension } from 'src/cloud-element-templates/Helper';
import { getLabel } from 'bpmn-js/lib/features/label-editing/LabelUtil';
import { findMessage, findSignal } from 'src/cloud-element-templates/Helper';
import { isExpanded } from 'bpmn-js/lib/util/DiUtil';

// eslint-disable-next-line no-undef
const packageVersion = process.env.PKG_VERSION;


describe('provider/cloud-element-templates - ElementTemplates', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapModeler(diagramXML, {
    container: container,
    modules: [
      coreModule,
      elementTemplatesCoreModule,
      modelingModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    }
  }));


  describe('get', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should get template by ID', inject(function(elementTemplates) {

      // when
      const template = elementTemplates.get('foo');

      // then
      expect(template.id).to.equal('foo');
      expect(template.version).not.to.exist;
    }));


    it('should get template by ID and version', inject(function(elementTemplates) {

      // when
      const template = elementTemplates.get('foo', 1);

      // then
      expect(template.id).to.equal('foo');
      expect(template.version).to.equal(1);
    }));


    it('should get template by element (template ID)', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_1');

      // when
      const template = elementTemplates.get(task);

      // then
      expect(template.id).to.equal('foo');
      expect(template.version).not.to.exist;
    }));


    it('should get template by element (template ID and version)', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_2');

      // when
      const template = elementTemplates.get(task);

      // then
      expect(template.id).to.equal('foo');
      expect(template.version).to.equal(1);
    }));


    it('should not get template (no template with ID)', inject(function(elementTemplates) {

      // when
      const template = elementTemplates.get('oof');

      // then
      expect(template).to.be.null;
    }));


    it('should not get template (no template with version)', inject(function(elementTemplates) {

      // when
      const template = elementTemplates.get('foo', -1);

      // then
      expect(template).to.be.null;
    }));


    it('should not get template (no template applied to element)', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_3');

      // when
      const template = elementTemplates.get(task);

      // then
      expect(template).to.be.null;
    }));

  });


  describe('getAll', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should get all templates', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getAll();

      // then
      expectTemplates(templates, [
        [ 'my.mail.Task' ],
        [ 'deprecated' ],
        [ 'default', 1 ],
        [ 'foo' ],
        [ 'foo', 1 ],
        [ 'foo', 2 ],
        [ 'foo', 3 ],
        [ 'bar', 1 ],
        [ 'bar', 2 ],
        [ 'baz' ],
        [ 'process-template', 1 ],
        [ 'subprocess-template', 1 ]
      ]);
    }));


    it('should get all template versions', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getAll('foo');

      // then
      expectTemplates(templates, [
        [ 'foo' ],
        [ 'foo', 1 ],
        [ 'foo', 2 ],
        [ 'foo', 3 ],
      ]);
    }));


    it('should get all applicable templates', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_3');

      // when
      const templates = elementTemplates.getAll(task);

      // then
      expectTemplates(templates, [
        [ 'foo' ],
        [ 'foo', 1 ],
        [ 'foo', 2 ],
        [ 'foo', 3 ],
        [ 'bar', 1 ],
        [ 'bar', 2 ],
        [ 'baz' ]
      ]);
    }));


    it('should throw for invalid argument', inject(function(elementTemplates) {

      // then
      expect(function() {
        elementTemplates.getAll(false);
      }).to.throw('argument must be of type {string|djs.model.Base|undefined}');

    }));

  });


  describe('getLatest', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should get all latest templates', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest();

      // then
      expectTemplates(templates, [
        [ 'my.mail.Task' ],
        [ 'default', 1 ],
        [ 'foo', 3 ],
        [ 'bar', 2 ],
        [ 'baz' ],
        [ 'process-template', 1 ],
        [ 'subprocess-template', 1 ]
      ]);
    }));


    it('should get all latest templates (including deprecated)', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest(null, { deprecated: true });

      // then
      expectTemplates(templates, [
        [ 'my.mail.Task' ],
        [ 'deprecated' ],
        [ 'default', 1 ],
        [ 'foo', 3 ],
        [ 'bar', 2 ],
        [ 'baz' ],
        [ 'process-template', 1 ],
        [ 'subprocess-template', 1 ]
      ]);
    }));


    it('should get latest template version', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest('bar');

      // then
      expectTemplates(templates, [
        [ 'bar', 2 ]
      ]);
    }));


    it('should get latest template version (including deprecated)', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest('deprecated', { deprecated: true });

      // then
      expectTemplates(templates, [
        [ 'deprecated' ]
      ]);
    }));


    it('should hide deprecated template version', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest('deprecated');

      // then
      expectTemplates(templates, []);
    }));


    it('should get latest template version (mixed versions)', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest('foo');

      // then
      expectTemplates(templates, [
        [ 'foo', 3 ]
      ]);
    }));


    it('should get latest template version (no version)', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest('baz');

      // then
      expectTemplates(templates, [
        [ 'baz' ]
      ]);
    }));


    it('should get all applicable templates', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_3');

      // when
      const templates = elementTemplates.getLatest(task);

      // then
      expectTemplates(templates, [
        [ 'foo', 3 ],
        [ 'bar', 2 ],
        [ 'baz' ]
      ]);
    }));


    describe('<engines> compatibility', function() {

      beforeEach(inject(function(elementTemplates) {
        elementTemplates.set(enginesTemplates);
      }));


      describe('should retrieve latest compatible', function() {

        it('single template', inject(function(elementTemplates) {

          // given
          elementTemplates.setEngines({
            camunda: '8.6.3'
          });

          // when
          const templates = elementTemplates.getLatest('example.engines.test.basic');

          // then
          expect(templates).to.have.length(1);
          expect(templates[0].version).to.eql(3);
        }));


        it('all templates', inject(function(elementTemplates) {

          // given
          elementTemplates.setEngines({
            camunda: '8.6.3'
          });

          // when
          const templates = elementTemplates.getLatest();

          // then
          // expect all compatible templates to be returned
          // example.engines.test.multiple v2
          // example.engines.test.basic v2
          expect(templates).to.have.length(2);
        }));

      });


      it('should retrieve older compatible', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: '8.5'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.basic');

        // then
        expect(templates).to.have.length(1);
        expect(templates[0].version).to.eql(2);
      }));


      it('should retrieve fallback (no <engines> meta-data)', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: '4'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.basic');

        // then
        expect(templates).to.have.length(1);
        expect(templates[0].version).to.eql(1);
      }));


      describe('should handle no context provided', function() {

        it('single template', inject(function(elementTemplates) {

          // given
          elementTemplates.setEngines({});

          // when
          const templates = elementTemplates.getLatest('example.engines.test.basic');

          // then
          expect(templates).to.have.length(1);
          expect(templates[0].version).to.eql(3);
        }));


        it('list templates', inject(function(elementTemplates) {

          // given
          elementTemplates.setEngines({});

          // when
          const templates = elementTemplates.getLatest();

          // then
          // example.engines.test.multiple v2
          // example.engines.test.basic v3
          // example.engines.test.broken v1
          expect(templates).to.have.length(3);
        }));

      });


      it('should support multiple engines', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: '8.6',
          webModeler: '4.3'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.multiple');

        // then
        expect(templates).to.have.length(1);
        expect(templates[0].version).to.eql(2);
      }));


      it('should exclude engine', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: '8.6',
          webModeler: '4.3',
          desktopModeler: '5.4'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.multiple');

        // then
        expect(templates).to.have.length(1);
        expect(templates[0].version).to.eql(1);
      }));


      it('should ignore incompatible', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: '8.4'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.multiple');

        // then
        expect(templates).to.be.empty;
      }));


      it('should handle broken <engines> provided at run-time', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: 'one-hundred'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.basic');

        // then
        // we ignore the context entry, assume it is not there
        expect(templates).to.have.length(1);
        expect(templates[0].version).to.eql(3);
      }));


      it('should handle broken <engines> provided by template', inject(function(elementTemplates) {

        // given
        elementTemplates.setEngines({
          camunda: '8.6'
        });

        // when
        const templates = elementTemplates.getLatest('example.engines.test.broken');

        // then
        expect(templates).to.be.empty;

        // and
        // we still regard such template as a valid template
        const template = elementTemplates.get('example.engines.test.broken', 1);
        expect(template).to.exist;
      }));

    });


    it('should throw for invalid argument', inject(function(elementTemplates) {

      // then
      expect(function() {
        elementTemplates.getLatest(false);
      }).to.throw('argument must be of type {string|djs.model.Base|undefined}');

    }));

  });


  describe('createElement', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should create element', inject(function(elementTemplates) {

      // given
      const templates = require('./fixtures/complex.json');

      // when
      const element = elementTemplates.createElement(templates[0]);

      const extensionElements = getBusinessObject(element).get('extensionElements');

      // then
      expect(element.businessObject.get('name')).to.eql('Rest Task');
      expect(extensionElements).to.exist;
      expect(extensionElements.get('values')).to.have.length(3);
    }));


    it('should create element with bpmn:MessageEventDefinition', inject(function(elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');

      // when
      const element = elementTemplates.createElement(templates[0]);

      const businessObject = getBusinessObject(element);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      expect(businessObject.get('name')).to.eql('Message Event');
      expect(eventDefinitions).to.have.lengthOf(1);
      expect(is(eventDefinitions[0], 'bpmn:MessageEventDefinition')).to.be.true;
    }));


    it('should create message', inject(function(elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');

      // when
      const element = elementTemplates.createElement(templates[0]);

      const businessObject = getBusinessObject(element);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      const message = eventDefinitions[0].get('messageRef');

      expect(message).to.exist;
      expect(message.get('name')).to.eql('hiddenName');
    }));


    it('should create message (Send Task)', inject(function(elementTemplates) {

      // given
      const template = messageTemplates[3];

      // when
      const element = elementTemplates.createElement(template);

      const businessObject = getBusinessObject(element);

      // then
      const message = businessObject.get('messageRef');

      expect(message).to.exist;
      expect(message.get('name')).to.eql('hiddenName');
    }));


    it('should create message subscription', inject(function(elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');

      // when
      const element = elementTemplates.createElement(templates[1]);

      const businessObject = getBusinessObject(element);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      const message = eventDefinitions[0].get('messageRef');

      expect(message).to.exist;

      const subscription = findExtension(message, 'zeebe:Subscription');
      expect(subscription).to.exist;
      expect(subscription.get('correlationKey')).to.eql('=correlationKey');
    }));


    it('should create message subscription (Send Task)', inject(function(elementTemplates) {

      // given
      const template = messageTemplates[3];

      // when
      const element = elementTemplates.createElement(template);

      const businessObject = getBusinessObject(element);

      // then
      const message = businessObject.get('messageRef');

      expect(message).to.exist;

      const subscription = findExtension(message, 'zeebe:Subscription');
      expect(subscription).to.exist;
      expect(subscription.get('correlationKey')).to.eql('=correlationKey');
    }));


    it('should create element with bpmn:SignalEventDefinition', inject(function(elementTemplates) {

      // given
      const templates = require('./fixtures/signal.json');

      // when
      const element = elementTemplates.createElement(templates[0]);

      const businessObject = getBusinessObject(element);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      expect(eventDefinitions).to.have.lengthOf(1);
      expect(is(eventDefinitions[0], 'bpmn:SignalEventDefinition')).to.be.true;
    }));


    it('should create signal', inject(function(elementTemplates) {

      // given
      const templates = require('./fixtures/signal.json');

      // when
      const element = elementTemplates.createElement(templates[0]);

      const businessObject = getBusinessObject(element);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      const signal = eventDefinitions[0].get('signalRef');

      expect(signal).to.exist;
      expect(signal.get('name')).to.eql('hiddenSignalName');
    }));


    it('should create element with zeebe:UserTask', inject(function(elementTemplates) {

      // given
      const template = require('./fixtures/user-task.json');

      // when
      const element = elementTemplates.createElement(template);

      // then
      const userTask = findExtension(element, 'zeebe:UserTask');
      expect(userTask).to.exist;
    }));


    it('should not create conditional properties', inject(function(elementTemplates) {

      // given
      const template = require('./fixtures/condition.json');

      // when
      const element = elementTemplates.createElement(template);

      const businessObject = getBusinessObject(element);

      // then
      // expect properties
      expect(businessObject.get('customProperty')).to.be.undefined;

      // expect ioMapping
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');
      expect(ioMapping).to.be.undefined;

      // expect taskHeaders
      const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders');
      expect(taskHeaders).to.be.undefined;

      // expect taskDefinition
      const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');
      expect(taskDefinition).to.be.undefined;
    }));


    it('should throw error - no template', inject(function(elementTemplates) {

      // given
      const emptyTemplate = null;

      // then
      expect(function() {
        elementTemplates.createElement(emptyTemplate);
      }).to.throw(/template is missing/);
    }));


    it('integration', inject(
      function(create, dragging, elementRegistry, elementTemplates) {

        // given
        const templates = require('./fixtures/complex.json');

        const processElement = elementRegistry.get('Process_1');

        const element = elementTemplates.createElement(templates[0]);

        // when
        create.start(canvasEvent({ x: 250, y: 300 }), element);
        dragging.move(canvasEvent({ x: 100, y: 200 }));
        dragging.hover({ element: processElement });
        dragging.end();

        // then
        expect(element).to.exist;
        expect(element.parent).to.eql(processElement);
      })
    );

  });


  describe('set', function() {

    it('should set templates', inject(function(elementTemplates) {

      // when
      elementTemplates.set(templates.slice(0, 3));

      // then
      expect(elementTemplates.getAll()).to.have.length(3);
    }));


    it('should not ignore version set to 0', inject(function(elementTemplates) {

      // when
      elementTemplates.set(falsyVersionTemplate);

      // then
      expect(elementTemplates.get(falsyVersionTemplate[0].id, 0)).to.exist;
    }));


    it('should emit <elementTemplates.changed> event', inject(function(elementTemplates, eventBus) {

      // given
      const spy = sinon.spy();

      eventBus.on('elementTemplates.changed', spy);

      // when
      elementTemplates.set(templates);

      // then
      expect(spy).to.have.been.calledOnce;
    }));

  });


  describe('getEngines', function() {

    it('should provide default <elementTemplates> engine', inject(function(elementTemplates) {

      // then
      expect(
        elementTemplates.getEngines()
      ).to.have.property('elementTemplates', packageVersion);
    }));


    it('should provide set engines', inject(function(elementTemplates) {

      // when
      elementTemplates.setEngines({
        'camunda': '8',
        'other': '100.5'
      });

      // then
      expect(elementTemplates.getEngines()).to.eql({
        'elementTemplates': packageVersion,
        'camunda': '8.0.0',
        'other': '100.5.0'
      });

    }));

  });


  describe('setEngines', function() {

    it('should emit event', inject(function(elementTemplates, eventBus) {

      // given
      const spy = sinon.spy();

      eventBus.on('elementTemplates.engines.changed', spy);

      // when
      elementTemplates.setEngines({});

      // then
      expect(spy).to.have.been.calledOnce;
    }));


    it('should override <elementTemplates> engine', inject(function(elementTemplates) {

      // when
      elementTemplates.setEngines({
        elementTemplates: '1.0.0'
      });

      // then
      expect(elementTemplates.getEngines()).to.have.property('elementTemplates', '1.0.0');
    }));

  });


  describe('applyTemplate', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should set template on element', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_1');

      const template = elementTemplates.getAll().find(
        t => isAny(task, t.appliesTo)
      );

      // assume
      expect(template).to.exist;

      // when
      const updatedTask = elementTemplates.applyTemplate(task, template);

      // then
      expect(updatedTask).to.exist;
      expect(elementTemplates.get(updatedTask)).to.equal(template);
    }));


    it('should only have 1 task definition', inject(function(elementRegistry, elementTemplates) {

      // given
      elementTemplates.set(complexTemplates);
      const task = elementRegistry.get('ConfiguredTask');
      const template = elementTemplates.get('io.camunda.connectors.RestConnector-s1');

      // when
      const updatedTask = elementTemplates.applyTemplate(task, template);

      // then
      expect(updatedTask).to.exist;
      expect(elementTemplates.get(updatedTask)).to.equal(template);

      const taskDefinitions = findExtensions(updatedTask, [ 'zeebe:TaskDefinition' ]);
      expect(taskDefinitions).to.have.length(1);
      expect(taskDefinitions[0].get('type')).to.eql('http');
    }));


    it('should apply valid dynamic property binding', inject(function(elementRegistry, elementTemplates) {

      // given
      elementTemplates.set([
        require('./fixtures/condition-dropdown-dynamic-values.json'),
        require('./fixtures/condition-dropdown-dynamic-values-1.json')
      ]);

      const template = elementTemplates.get('condition-dropdown-dynamic-values');
      const task = elementTemplates.applyTemplate(elementRegistry.get('Task_3'), template);

      // assume
      expect(
        task.businessObject.extensionElements.values[0].inputParameters[0].source
      ).to.eql(
        'action1'
      );

      expect(
        task.businessObject.extensionElements.values[1].type
      ).to.eql(
        'action1-value'
      );

      // when
      const newTemplate = elementTemplates.get('condition-dropdown-dynamic-values-1');
      const updatedTask = elementTemplates.applyTemplate(task, newTemplate);

      // then
      expect(updatedTask).to.exist;

      // assume
      expect(
        updatedTask.businessObject.extensionElements.values[0].inputParameters[0].source
      ).to.eql(
        'action1'
      );

      expect(
        updatedTask.businessObject.extensionElements.values[1].type
      ).to.eql(
        'action1-value-2'
      );
    }));


    it('should apply start event template without event definition', inject(
      function(elementRegistry, elementTemplates) {

        // given
        const templates = require('./fixtures/start-event.json');
        elementTemplates.set(templates);

        const template = templates[0];
        const event = elementRegistry.get('IntermediateThrow');

        // assume
        expect(template).to.exist;

        // when
        const updatedEvent = elementTemplates.applyTemplate(event, template);

        // then
        expect(updatedEvent).to.exist;
        expect(elementTemplates.get(updatedEvent)).to.equal(template);

        expect(is(updatedEvent, 'bpmn:StartEvent')).to.be.true;

        const eventDefinitions = getBusinessObject(updatedEvent).get('eventDefinitions');
        expect(eventDefinitions).to.be.empty;
      })
    );


    it('should apply event definition', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');
      elementTemplates.set(templates);

      const template = templates[0];
      const event = elementRegistry.get('IntermediateThrow');

      // assume
      expect(template).to.exist;

      // when
      const updatedEvent = elementTemplates.applyTemplate(event, template);

      // then
      expect(updatedEvent).to.exist;
      expect(elementTemplates.get(updatedEvent)).to.equal(template);

      expect(is(updatedEvent, 'bpmn:IntermediateCatchEvent')).to.be.true;

      const eventDefinitions = getBusinessObject(updatedEvent).get('eventDefinitions');
      expect(eventDefinitions).to.have.length(1);
      expect(is(eventDefinitions[0], 'bpmn:MessageEventDefinition')).to.be.true;
    }));


    it('should replace existing event definition', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');
      elementTemplates.set(templates);

      const template = templates[0];
      const event = elementRegistry.get('IntermediateCatchMessage');
      const oldMessageEventDefinition = getBusinessObject(event).get('eventDefinitions')[0];

      // assume
      expect(template).to.exist;

      // when
      const updatedEvent = elementTemplates.applyTemplate(event, template);

      // then
      expect(updatedEvent).to.exist;
      expect(elementTemplates.get(updatedEvent)).to.equal(template);

      expect(is(updatedEvent, 'bpmn:IntermediateCatchEvent')).to.be.true;

      const eventDefinitions = getBusinessObject(updatedEvent).get('eventDefinitions');
      expect(eventDefinitions).to.have.length(1);
      expect(is(eventDefinitions[0], 'bpmn:MessageEventDefinition')).to.be.true;
      expect(eventDefinitions[0]).not.to.eql(oldMessageEventDefinition);
    }));


    it('should remove existing event definition', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = require('./fixtures/start-event.json');
      elementTemplates.set(templates);

      const template = templates[0];
      const event = elementRegistry.get('MessageStartEvent');
      const oldMessageEventDefinition = getBusinessObject(event).get('eventDefinitions')[0];

      // assume
      expect(oldMessageEventDefinition).to.exist;
      expect(template).to.exist;

      // when
      const updatedEvent = elementTemplates.applyTemplate(event, template);

      // then
      expect(updatedEvent).to.exist;
      expect(elementTemplates.get(updatedEvent)).to.equal(template);
      expect(is(updatedEvent, 'bpmn:StartEvent')).to.be.true;

      const eventDefinitions = getBusinessObject(updatedEvent).get('eventDefinitions');
      expect(eventDefinitions).to.have.length(0);
    }));


    it('should apply message binding', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');
      elementTemplates.set(templates);

      const template = templates[0];
      const event = elementRegistry.get('IntermediateCatchMessage');

      // assume
      expect(template).to.exist;

      // when
      const updatedEvent = elementTemplates.applyTemplate(event, template);

      // then
      const businessObject = getBusinessObject(updatedEvent);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      const message = eventDefinitions[0].get('messageRef');

      expect(message).to.exist;
      expect(message.get('name')).to.eql('hiddenName');
    }));


    it('should apply signal binding', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = require('./fixtures/signal.json');
      elementTemplates.set(templates);

      const template = templates[0];
      const event = elementRegistry.get('IntermediateCatchMessage');

      // assume
      expect(template).to.exist;

      // when
      const updatedEvent = elementTemplates.applyTemplate(event, template);

      // then
      const businessObject = getBusinessObject(updatedEvent);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      const signal = eventDefinitions[0].get('signalRef');

      expect(signal).to.exist;
      expect(signal.get('name')).to.eql('hiddenSignalName');
    }));


    it('should apply message zeebe:subscription binding', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = require('./fixtures/message.json');
      elementTemplates.set(templates);

      const template = templates[1];
      const event = elementRegistry.get('IntermediateCatchMessage');

      // assume
      expect(template).to.exist;

      // when
      const updatedEvent = elementTemplates.applyTemplate(event, template);

      // then
      const businessObject = getBusinessObject(updatedEvent);
      const eventDefinitions = businessObject.get('eventDefinitions');

      // then
      const message = eventDefinitions[0].get('messageRef');

      expect(message).to.exist;

      const subscription = findExtension(message, 'zeebe:Subscription');
      expect(subscription).to.exist;
      expect(subscription.get('correlationKey')).to.eql('=correlationKey');
    }));


    it('should apply zeebe:userTask binding', inject(function(elementRegistry, elementTemplates) {

      // given
      const template = require('./fixtures/user-task.json');
      elementTemplates.set([ template ]);

      const task = elementRegistry.get('Task_3');

      // when
      const updatedTask = elementTemplates.applyTemplate(task, template);

      // then
      const userTask = findExtension(updatedTask, 'zeebe:UserTask');
      expect(userTask).to.exist;
    }));


    it('should not create <zeebe:UserTask> if it exists', inject(function(elementRegistry, elementTemplates) {

      // given
      const template = require('./fixtures/user-task.json');
      elementTemplates.set([ template ]);

      const task = elementRegistry.get('UserTask_1');

      // assume
      const userTask = findExtension(task, 'zeebe:UserTask');
      expect(userTask).to.exist;

      // when
      const updatedTask = elementTemplates.applyTemplate(task, template);

      // then
      const updatedUserTask = findExtensions(updatedTask, [ 'zeebe:UserTask' ]);
      expect(updatedUserTask).to.have.length(1);
    }));


    it('should not create <zeebe:UserTask> if template has no binding', inject(function(elementRegistry, elementTemplates) {

      // given
      const template = require('./fixtures/user-task-no-binding.json');

      // when
      const task = elementTemplates.createElement(template);

      // then
      const updatedUserTask = findExtension(task, 'zeebe:UserTask');
      expect(updatedUserTask).to.not.exist;
    }));


    it('should remove <zeebe:UserTask> if new template has no binding', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = [
        require('./fixtures/user-task.json'),
        require('./fixtures/user-task-no-binding.json')
      ];
      elementTemplates.set(templates);

      // when
      const task = elementTemplates.createElement(templates[0]);

      // assume
      expect(findExtension(task, 'zeebe:UserTask')).to.exist;

      // when
      const updatedTask = elementTemplates.applyTemplate(task, templates[1]);

      // then
      const updatedUserTask = findExtension(updatedTask, 'zeebe:UserTask');
      expect(updatedUserTask).to.not.exist;
    }));


    it('should fire elementTemplates.apply event', inject(function(elementRegistry, elementTemplates, eventBus) {

      // given
      const task = elementRegistry.get('Task_1');
      const oldTemplate = elementTemplates.get(task);
      const newTemplate = templates[6];
      const spy = sinon.spy();

      eventBus.on('elementTemplates.apply', spy);

      // when
      elementTemplates.applyTemplate(task, newTemplate);

      // then
      expect(spy).to.have.been.calledOnce;
      expect(spy.getCalls()[0].args[1]).to.eql({
        element: task,
        oldTemplate,
        newTemplate
      });
    }));


    it('should apply a template with a completion condition', inject(function(elementRegistry, elementTemplates) {

      // given
      const templates = completionConditionTemplates;
      elementTemplates.set(templates);

      const template = templates[0];
      const task = elementRegistry.get('Task_1');

      // assume
      expect(template).to.exist;

      // when
      const updatedTask = elementTemplates.applyTemplate(task, template);

      // then
      expect(updatedTask).to.exist;
      expect(elementTemplates.get(updatedTask)).to.equal(template);

      const businessObject = getBusinessObject(updatedTask);
      const completionCondition = businessObject.get('completionCondition');

      expect(completionCondition).to.exist;
      expect(is(completionCondition, 'bpmn:Expression'), 'should be a BPMN expression').to.be.true;
    }));
  });


  describe('unlinkTemplate', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should unlink task template', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_1');

      // when
      elementTemplates.unlinkTemplate(task);

      // then
      const taskBo = getBusinessObject(task);

      expect(taskBo.modelerTemplate).not.to.exist;
      expect(taskBo.modelerTemplateVersion).not.to.exist;
      expect(taskBo.name).to.equal('foo');
    }));


    it('should remove template icon', inject(function(elementRegistry, elementTemplates) {

      // given
      let task = elementRegistry.get('Task_2');

      // assume
      expect(getBusinessObject(task).get('zeebe:modelerTemplateIcon')).to.exist;

      // when
      elementTemplates.unlinkTemplate(task);

      // then
      task = elementRegistry.get('Task_1');
      expect(getBusinessObject(task).get('zeebe:modelerTemplateIcon')).to.not.exist;
    }));


    it('should fire elementTemplates.unlink event', inject(function(elementRegistry, elementTemplates, eventBus) {

      // given
      const task = elementRegistry.get('Task_1');
      const oldTemplate = elementTemplates.get(task);
      const spy = sinon.spy();

      eventBus.on('elementTemplates.unlink', spy);

      // when
      elementTemplates.unlinkTemplate(task);

      // then
      expect(spy).to.have.been.calledOnce;
      expect(spy.getCalls()[0].args[1]).to.eql({
        element: task,
        oldTemplate
      });
    }));
  });


  describe('removeTemplate', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(templates);
    }));


    it('should remove task template', inject(function(elementRegistry, elementTemplates) {

      // given
      let task = elementRegistry.get('Task_1');

      // when
      task = elementTemplates.removeTemplate(task);

      // then
      const taskBo = getBusinessObject(task);
      const label = getLabel(task);

      expect(taskBo.modelerTemplate).not.to.exist;
      expect(taskBo.modelerTemplateVersion).not.to.exist;
      expect(label).to.eql('foo');
    }));


    it('should remove default task template', inject(function(elementRegistry, elementTemplates) {

      // given
      let task = elementRegistry.get('ServiceTask');

      // when
      task = elementTemplates.removeTemplate(task);

      // then
      const taskBo = getBusinessObject(task);

      expect(taskBo.modelerTemplate).not.to.exist;
      expect(taskBo.modelerTemplateVersion).not.to.exist;
    }));


    it('should remove group template', inject(function(elementRegistry, elementTemplates) {

      // given
      let group = elementRegistry.get('Group_1');

      // when
      group = elementTemplates.removeTemplate(group);

      // then
      const groupBo = getBusinessObject(group);
      const label = getLabel(group);

      expect(groupBo.modelerTemplate).not.to.exist;
      expect(groupBo.modelerTemplateVersion).not.to.exist;
      expect(label).to.eql('Group Name');
    }));


    it('should remove annotation template', inject(function(elementRegistry, elementTemplates) {

      // given
      let annotation = elementRegistry.get('TextAnnotation_1');

      // when
      annotation = elementTemplates.removeTemplate(annotation);

      // then
      const annotationBo = getBusinessObject(annotation);
      const label = getLabel(annotation);

      expect(annotationBo.modelerTemplate).not.to.exist;
      expect(annotationBo.modelerTemplateVersion).not.to.exist;
      expect(label).to.eql('Text Annotation');
    }));


    it('should remove conditional event template', inject(function(elementRegistry, elementTemplates) {

      // given
      let event = elementRegistry.get('ConditionalEvent');

      // when
      event = elementTemplates.removeTemplate(event);

      // then
      const eventBo = getBusinessObject(event);

      expect(eventBo.modelerTemplate).not.to.exist;
      expect(eventBo.modelerTemplateVersion).not.to.exist;
      expect(eventBo.eventDefinitions).to.have.length(1);
    }));


    it('should remove process template', inject(function(elementRegistry, elementTemplates) {

      // given
      let process = elementRegistry.get('Process_1');
      const children = [ ...process.children ];

      // when
      process = elementTemplates.removeTemplate(process);

      // then
      const processBo = getBusinessObject(process);

      expect(processBo.modelerTemplate).not.to.exist;
      expect(processBo.modelerTemplateVersion).not.to.exist;
      expect(process.children.length).to.eql(children.length);
    }));


    it('should remove subprocess template (plane)', inject(function(elementRegistry, elementTemplates) {

      // given
      let subprocess = elementRegistry.get('SubProcess_1');
      let subprocessPlane = elementRegistry.get('SubProcess_1_plane');

      // when
      subprocess = elementTemplates.removeTemplate(subprocessPlane);

      // then
      const taskBo = getBusinessObject(subprocess);

      expect(taskBo.modelerTemplate).not.to.exist;
      expect(taskBo.modelerTemplateVersion).not.to.exist;
      expect(taskBo.flowElements).to.have.length(1);
    }));


    it('should fire elementTemplates.remove event', inject(function(elementRegistry, elementTemplates, eventBus) {

      // given
      const task = elementRegistry.get('Task_1');
      const oldTemplate = elementTemplates.get(task);
      const spy = sinon.spy();

      eventBus.on('elementTemplates.remove', spy);

      // when
      elementTemplates.removeTemplate(task);

      // then
      expect(spy).to.have.been.calledOnce;
      expect(spy.getCalls()[0].args[1]).to.eql({
        element: task,
        oldTemplate
      });
    }));


    it('should keep documentation', inject(function(elementRegistry, elementTemplates) {

      // given
      let task = elementRegistry.get('Task_1');

      // assume
      const bo = getBusinessObject(task);
      expect(bo.documentation[0].text).to.exist;

      // when
      task = elementTemplates.removeTemplate(task);

      // then
      const newBo = getBusinessObject(task);
      expect(newBo.documentation[0].text).to.exist;
    }));


    it('should keep execution listeners', inject(function(elementRegistry, elementTemplates) {

      // given
      let task = elementRegistry.get('Task_5');

      // when
      task = elementTemplates.removeTemplate(task);

      // then
      const bo = getBusinessObject(task);
      expect(bo.extensionElements.values[0].$type).to.equal('zeebe:ExecutionListeners');
    }));


    it('should keep expanded state of subprocess', inject(function(elementRegistry, elementTemplates) {

      // given
      let subprocess = elementRegistry.get('SubProcess_2');

      expect(isExpanded(subprocess)).to.be.true;

      // when
      subprocess = elementTemplates.removeTemplate(subprocess);

      // then
      expect(isExpanded(subprocess)).to.be.true;
    }));

  });


  describe('updateTemplate', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set([
        ...templates,
        ...messageTemplates
      ]);
    }));


    it('should update template', inject(function(elementRegistry, elementTemplates) {

      // given
      const newTemplate = templates.find(
        template => template.id === 'foo' && template.version === 2);
      const task = elementRegistry.get('Task_1');

      // when
      elementTemplates.applyTemplate(task, newTemplate);

      // then
      const taskBo = getBusinessObject(task);

      expect(taskBo.modelerTemplate).to.eql('foo');
      expect(taskBo.modelerTemplateVersion).to.eql(2);
    }));


    it('should update message event template', inject(function(elementRegistry, elementTemplates) {

      // given
      const newTemplate = messageTemplates.find(
        template => template.id === 'updateTemplate' && template.version === 2);
      let event = elementRegistry.get('MessageEvent');


      // when
      event = elementTemplates.applyTemplate(event, newTemplate);

      // then
      const eventBo = getBusinessObject(event);

      expect(eventBo.modelerTemplate).to.eql('updateTemplate');
      expect(eventBo.modelerTemplateVersion).to.eql(2);

      const message = findMessage(eventBo);
      expect(message.name).to.eql('version_2');
    }));


    it('should update message event template but keep user-edited name',
      inject(function(elementRegistry, modeling, elementTemplates) {

        // given
        const newTemplate = messageTemplates.find(
          template => template.id === 'updateTemplate' && template.version === 2);
        let event = elementRegistry.get('MessageEvent'),
            eventBo = getBusinessObject(event);
        modeling.updateModdleProperties(event, findMessage(eventBo), { name: 'user_edited' });

        // when
        event = elementTemplates.applyTemplate(event, newTemplate);

        // then
        eventBo = getBusinessObject(event);

        expect(eventBo.modelerTemplate).to.eql('updateTemplate');
        expect(eventBo.modelerTemplateVersion).to.eql(2);

        const message = findMessage(eventBo);
        expect(message.name).to.eql('user_edited');
      })
    );


    it('should update signal event template', inject(function(elementRegistry, elementTemplates) {

      // given
      const signalTemplates = require('./fixtures/signal.json');
      const updateTemplates = signalTemplates.filter(t => t.id === 'updateSignalTemplate');
      const newTemplate = updateTemplates.find(t => t.version === 2);
      elementTemplates.set(updateTemplates);
      let event = elementRegistry.get('SignalEvent');


      // when
      event = elementTemplates.applyTemplate(event, newTemplate);

      // then
      const eventBo = getBusinessObject(event);

      expect(eventBo.modelerTemplate).to.eql('updateSignalTemplate');
      expect(eventBo.modelerTemplateVersion).to.eql(2);

      const signal = findSignal(eventBo);
      expect(signal.name).to.eql('signal_version_2');
    }));


    it('should update signal event template but keep user-edited name',
      inject(function(elementRegistry, modeling, elementTemplates) {

        // given
        const signalTemplates = require('./fixtures/signal.json');
        const updateTemplates = signalTemplates.filter(t => t.id === 'updateSignalTemplate');
        const newTemplate = updateTemplates.find(t => t.version === 2);
        elementTemplates.set(updateTemplates);
        let event = elementRegistry.get('SignalEvent'),
            eventBo = getBusinessObject(event);
        modeling.updateModdleProperties(event, findSignal(eventBo), { name: 'user_edited' });

        // when
        event = elementTemplates.applyTemplate(event, newTemplate);

        // then
        eventBo = getBusinessObject(event);

        expect(eventBo.modelerTemplate).to.eql('updateSignalTemplate');
        expect(eventBo.modelerTemplateVersion).to.eql(2);

        const signal = findSignal(eventBo);
        expect(signal.name).to.eql('user_edited');
      })
    );


    it('should fire elementTemplates.update event', inject(function(elementRegistry, elementTemplates, eventBus) {

      // given
      const newTemplate = templates.find(
        template => template.id === 'foo' && template.version === 2);

      const task = elementRegistry.get('Task_1');
      const oldTemplate = elementTemplates.get(task);
      const spy = sinon.spy();

      eventBus.on('elementTemplates.update', spy);

      // when
      elementTemplates.applyTemplate(task, newTemplate);

      // then
      expect(spy).to.have.been.calledOnce;
      expect(spy.getCalls()[0].args[1]).to.eql({
        element: task,
        oldTemplate,
        newTemplate
      });
    }));

  });


  describe('isCompatible', function() {

    const compatibleTemplate = {
      engines: {
        camunda: '^8.5'
      }
    };

    const incompatibleTemplate = {
      engines: {
        camunda: '^8.6'
      }
    };


    it('should accept compatible', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '8.5'
      });

      // then
      expect(elementTemplates.isCompatible(compatibleTemplate)).to.be.true;
    }));


    it('should reject incompatible', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '8.5'
      });

      // then
      expect(elementTemplates.isCompatible(incompatibleTemplate)).to.be.false;
    }));


    it('should accept non matching engine', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        nonMatchingEngine: '8.5'
      });

      // then
      expect(elementTemplates.isCompatible(compatibleTemplate)).to.be.true;
      expect(elementTemplates.isCompatible(incompatibleTemplate)).to.be.true;
    }));

  });


  describe('error handling', function() {

    // given
    const invalidEngines = {
      camunda: '8.5',
      invalid: 'not-a-semver'
    };

    it('should filter invalid <engines> on set', inject(function(elementTemplates) {

      // when
      elementTemplates.setEngines(invalidEngines);

      // then
      expect(elementTemplates.getEngines()).to.have.property('camunda');
      expect(elementTemplates.getEngines()).to.not.have.property('invalid');
    }));
  });


  describe('getIncompatibleEngines', function() {

    it('should return incompatible engine', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '8.5'
      });

      const template = {
        engines: {
          camunda: '>= 8.6'
        }
      };

      // then
      const result = elementTemplates.getIncompatibleEngines(template);

      expect(result).to.eql({
        camunda: {
          actual: '8.5.0',
          required: '>= 8.6'
        }
      });
    }));


    it('should return multiple', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '8.5',
        desktopModeler: '5.30'
      });

      const template = {
        engines: {
          camunda: '>= 8.6',
          desktopModeler: '^4.0'
        }
      };

      // then
      const result = elementTemplates.getIncompatibleEngines(template);

      expect(result).to.eql({
        camunda: {
          actual: '8.5.0',
          required: '>= 8.6'
        },
        desktopModeler: {
          actual: '5.30.0',
          required: '^4.0'
        }
      });
    }));


    it('should return empty object if compatible', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        nonMatchingEngine: '8.5'
      });

      const template = {
        engines: {
          camunda: '8.5',
        }
      };

      // then
      const result = elementTemplates.getIncompatibleEngines(template);

      expect(result).to.eql({});
    }));

  });

});


describe('provider/cloud-element-templates - ElementTemplates - error handling on instantiation', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  // given
  const invalidEngines = {
    camunda: '8.5',
    invalid: 'not-a-semver'
  };

  beforeEach(bootstrapModeler(diagramXML, {
    container: container,
    modules: [
      coreModule,
      modelingModule,
      elementTemplatesCoreModule,
    ],
    elementTemplates: {
      engines: invalidEngines
    }
  }));


  it('should filter invalid <engines> on instantiation', inject(function(elementTemplates) {

    // then
    expect(elementTemplates.getEngines()).to.have.property('camunda', '8.5.0');
    expect(elementTemplates.getEngines()).to.not.have.property('invalid');
  }));

});




describe('provider/cloud-element-templates - ElementTemplates - integration', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });


  describe('applyTemplate', function() {

    /*
      These Tests confirm that our assumptions for keeping bindings hold true
      over different scenrios. The basic assumptions are:

       * Existing values will be kept, if they are valid in the new template
       * Hidden values defined in the new template override existing values
       * New default values override old (unchanged) default values

      For unit tests over all possbile values, see `./cmd/ChangeElementTemplateHandler.spec.js`
      cf. https://github.com/bpmn-io/bpmn-js-properties-panel/issues/638
    */


    beforeEach(bootstrapModeler(integrationXML, {
      container: container,
      modules: [
        coreModule,
        elementTemplatesCoreModule,
        modelingModule
      ],
      moddleExtensions: {
        zeebe: zeebeModdlePackage
      }
    }));


    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(integrationTemplates);
    }));


    it('Service Task => Template', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let task = elementRegistry.get('configuredTask');
        const template = elementTemplates.get('templateA', 1);

        // assume
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'existing'
          },
          {
            target: 'changedDefaultValue',
            source: 'existing'
          },
          {
            target: 'hiddenValue',
            source: 'existing'
          }
        ]);

        // when
        task = elementTemplates.applyTemplate(task, template);

        // then
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'existing'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'existing'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);
      }
    ));


    it('Template v1 => Template v2', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let task = elementRegistry.get('templateTask');
        const template = elementTemplates.get('templateA', 2);

        // assume
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);

        // when
        task = elementTemplates.applyTemplate(task, template);

        // then
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A2'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A2'
          }
        ]);
      }
    ));


    it('Template A => Template B', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let task = elementRegistry.get('templateTask');
        const template = elementTemplates.get('templateB');

        // assume
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);

        // when
        task = elementTemplates.applyTemplate(task, template);

        // then
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'B'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'B'
          }
        ]);
      }
    ));


    it('Template => ServiceTask (unlink)', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let task = elementRegistry.get('templateTask');

        // assume
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);

        // when
        task = elementTemplates.applyTemplate(task, null);

        // then
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);
      }
    ));


    it('Template => ServiceTask => Template', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let task = elementRegistry.get('templateTask');
        const template = elementTemplates.get(task);

        // when
        task = elementTemplates.applyTemplate(task, null);
        task = elementTemplates.applyTemplate(task, template);

        // then
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);
      }
    ));


    it('REST Connector (Basic auth) => REST Connector', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let task = elementRegistry.get('REST_TASK');
        const template = elementTemplates.get('io.camunda.connectors.HttpJson.v2');

        // assume
        expectInputs(task, [
          {
            target: 'authentication.type',
            source: 'basic'
          },
          {
            target: 'url',
            source: 'https://foo'
          },
          {
            target: 'authentication.username',
            source: 'aaa'
          }
        ]);

        // when
        task = elementTemplates.applyTemplate(task, template);

        // then
        expectInputs(task, [
          {
            target: 'authentication.type',
            source: 'basic'
          },
          {
            target: 'url',
            source: 'https://foo'
          },
          {
            target: 'authentication.username',
            source: 'aaa'
          }
        ]);
      }
    ));


    /**
     * Dropdowns should always keep the last existing value if it is a valid
     * option in the dropdown.
     */
    it('Template A => Template B (with dropdowns)', inject(
      function(elementRegistry, elementTemplates) {
        let task = elementRegistry.get('templateTask');
        const template = elementTemplates.get('TemplateBDropdown');

        // assume
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'A1-changed'
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);


        // when
        task = elementTemplates.applyTemplate(task, template);

        // then
        expectInputs(task, [
          {
            target: 'normalValue',
            source: 'A1'
          },
          {
            target: 'defaultValue',
            source: 'A1'
          },
          {
            target: 'changedDefaultValue',
            source: 'B' // existing value is not a valid option, take the default
          },
          {
            target: 'hiddenValue',
            source: 'A1'
          }
        ]);

      }
    ));


    it('Github message start => Webhook blank-start', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let startEvent = elementRegistry.get('startEvent');
        const template = elementTemplates.get('io.camunda.connectors.webhook.WebhookConnector.v1');

        // when
        const applyTemplate = () => elementTemplates.applyTemplate(startEvent, template);

        // expect
        expect(applyTemplate).not.to.throw();
      }
    ));

  });

});


// helpers //////////////////////

function expectTemplates(templates, expected) {

  expect(templates).to.exist;
  expect(templates).to.have.length(expected.length);

  expected.forEach(function([ id, version ]) {
    expect(templates.find(t => t.id === id && t.version === version)).to.exist;
  });
}

function expectInputs(element, expected) {
  const ioMapping = findExtension(element, 'zeebe:IoMapping');
  expect(ioMapping).to.exist;

  const inputs = ioMapping.get('zeebe:inputParameters');
  expect(inputs).to.have.length(expected.length);

  expected.forEach(function({ source, target }) {
    const input = inputs.find(i => {
      return i.get('source') === source && i.get('target') === target;
    });

    expect(input, `<${source}> -> <${target}> binding`).to.exist;
  });
}