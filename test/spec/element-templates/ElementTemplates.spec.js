import TestContainer from 'mocha-test-container-support';

import {
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesModule from 'src/element-templates';
import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';
import modelingModule from 'bpmn-js/lib/features/modeling';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import { getLabel } from 'bpmn-js/lib/features/label-editing/LabelUtil';

import camundaModdlePackage from 'camunda-bpmn-moddle/resources/camunda';

import diagramXML from './ElementTemplates.bpmn';

import templates from './fixtures/simple';
import falsyVersionTemplate from './fixtures/falsy-version';
import enginesTemplates from './ElementTemplates.engines-templates.json';


describe('provider/element-templates - ElementTemplates', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapModeler(diagramXML, {
    container: container,
    modules: [
      coreModule,
      elementTemplatesModule,
      modelingModule,
      BpmnPropertiesPanelModule,
      {
        propertiesPanel: [ 'value', { registerProvider() {} } ]
      }
    ],
    moddleExtensions: {
      camunda: camundaModdlePackage
    }
  }));

  beforeEach(inject(function(elementTemplates) {
    elementTemplates.set(templates);
  }));


  describe('get', function() {

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


    it('should not get template (no template with ID + version)', inject(function(elementTemplates) {

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


  describe('getDefault', function() {

    it('should get default template for element', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('ServiceTask');

      // when
      const template = elementTemplates.getDefault(task);

      // then
      expect(template.id).to.equal('default');
      expect(template.version).to.equal(1);
      expect(template.isDefault).to.be.true;
    }));

  });


  describe('getAll', function() {

    it('should get all templates', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getAll();

      // then
      expectTemplates(templates, [
        [ 'default', 1 ],
        [ 'foo' ],
        [ 'foo', 1 ],
        [ 'foo', 2 ],
        [ 'foo', 3 ],
        [ 'bar', 1 ],
        [ 'bar', 2 ],
        [ 'baz' ],
        [ 'deprecated' ],
        [ 'qux' ],
        [ 'process-template' ],
        [ 'subprocess-template' ]
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
        [ 'baz' ],
        [ 'deprecated' ]
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
            camunda: '7.14.3'
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
            camunda: '7.14.3'
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
          camunda: '7.13'
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
          camunda: '7.14',
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
          camunda: '7.14',
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
          camunda: '7.12'
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
          camunda: '7.14'
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
        elementTemplates.getAll(false);
      }).to.throw('argument must be of type {string|djs.model.Base|undefined}');

    }));

  });


  describe('getLatest', function() {

    it('should get all latest templates', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest();

      // then
      expectTemplates(templates, [
        [ 'default', 1 ],
        [ 'foo', 3 ],
        [ 'bar', 2 ],
        [ 'baz' ],
        [ 'qux' ],
        [ 'process-template' ],
        [ 'subprocess-template' ]
      ]);
    }));


    it('should get all latest templates (including deprecated)', inject(function(elementTemplates) {

      // when
      const templates = elementTemplates.getLatest(null, { deprecated: true });

      // then
      expectTemplates(templates, [
        [ 'default', 1 ],
        [ 'foo', 3 ],
        [ 'bar', 2 ],
        [ 'baz' ],
        [ 'deprecated' ],
        [ 'qux' ],
        [ 'process-template' ],
        [ 'subprocess-template' ]
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


    it('should hide deprecated template', inject(function(elementTemplates) {

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


    it('should throw for invalid argument', inject(function(elementTemplates) {

      // then
      expect(function() {
        elementTemplates.getLatest(false);
      }).to.throw('argument must be of type {string|djs.model.Base|undefined}');

    }));

  });


  describe('getCompatible', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(enginesTemplates);
    }));


    it('should return templates compatible with engine override (upgrade)', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '7.13.0'
      });

      // assume
      const initialTemplates = elementTemplates.getLatest('example.engines.test.basic');
      expect(initialTemplates[0].version).to.eql(2);

      // when
      const newTemplates = elementTemplates.getCompatible('example.engines.test.basic', {
        camunda: '7.14.3'
      });

      // then
      expect(newTemplates).to.have.length(1);
      expect(newTemplates[0].version).to.eql(3);
    }));


    it('should return templates compatible with engine override (downgrade)', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '7.15.0'
      });

      // assume
      const initialTemplates = elementTemplates.getLatest('example.engines.test.basic');
      expect(initialTemplates[0].version).to.eql(3);

      // when
      const oldTemplates = elementTemplates.getCompatible('example.engines.test.basic', {
        camunda: '7.13.0'
      });

      // then
      expect(oldTemplates).to.have.length(1);
      expect(oldTemplates[0].version).to.eql(2);
    }));


    it('should filter by element', inject(function(elementTemplates, elementRegistry) {

      // given
      const task = elementRegistry.get('Task_1');

      elementTemplates.setEngines({
        camunda: '7.13.0'
      });

      // when
      const templates = elementTemplates.getCompatible(task, {
        camunda: '7.15.0'
      });

      // then
      expect(templates).to.have.length(2);
      expect(templates.map(t => t.id)).to.eql([
        'example.engines.test.multiple',
        'example.engines.test.basic'
      ]);
    }));


    it('should return elements if irrelevant engine override is provided', inject(function(elementTemplates) {

      // given
      elementTemplates.setEngines({
        camunda: '7.15.0'
      });

      // when
      const templates = elementTemplates.getCompatible(null, {
        irrelevantEngine: '12.0.0'
      });

      // then
      expect(templates).to.have.length(2);
      expect(templates.map(t => t.id)).to.eql([
        'example.engines.test.multiple',
        'example.engines.test.basic'
      ]);
    }));

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

  });


  describe('applyTemplate', function() {

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

  });


  describe('removeTemplate', function() {

    it('should remove task template', inject(function(elementRegistry, elementTemplates) {

      // given
      let task = elementRegistry.get('Task_4');

      // when
      task = elementTemplates.removeTemplate(task);

      // then
      const taskBo = getBusinessObject(task);
      const label = getLabel(task);

      expect(taskBo.modelerTemplate).not.to.exist;
      expect(taskBo.modelerTemplateVersion).not.to.exist;
      expect(taskBo.asyncBefore).to.be.false;
      expect(label).to.eql('Task 4');
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
      expect(taskBo.asyncBefore).to.be.false;
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
      expect(label).to.eql('Group 1');
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
      expect(label).to.eql('Text Annotation 1');
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
      expect(eventBo.asyncBefore).to.be.false;
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

  });


  describe('unlinkTemplate', function() {

    it('should unlink task template', inject(function(elementRegistry, elementTemplates) {

      // given
      const task = elementRegistry.get('Task_4');

      // when
      elementTemplates.unlinkTemplate(task);

      // then
      const taskBo = getBusinessObject(task);

      expect(taskBo.modelerTemplate).not.to.exist;
      expect(taskBo.modelerTemplateVersion).not.to.exist;
      expect(taskBo.asyncBefore).to.be.true;
    }));

  });


  describe('updateTemplate', function() {

    it('should update template', inject(function(elementRegistry, elementTemplates) {

      // given
      const newTemplate = templates.find(
        template => template.id === 'foo' && template.version === 2);
      const task = elementRegistry.get('Task_4');

      // when
      elementTemplates.applyTemplate(task, newTemplate);

      // then
      const taskBo = getBusinessObject(task);

      expect(taskBo.modelerTemplate).to.eql('foo');
      expect(taskBo.modelerTemplateVersion).to.eql(2);
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
      camunda: '7.12',
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

});


// helpers //////////////////////

function expectTemplates(templates, expected) {

  expect(templates).to.exist;
  expect(templates).to.have.length(expected.length);

  expected.forEach(function([ id, version ]) {
    expect(templates.find(t => t.id === id && t.version === version)).to.exist;
  });
}