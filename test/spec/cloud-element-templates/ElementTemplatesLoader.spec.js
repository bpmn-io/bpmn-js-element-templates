import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';
import { spy } from 'sinon';

import { bootstrapModeler, inject } from 'test/TestHelper';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';
import elementTemplatesCoreModule from 'src/cloud-element-templates/core';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import diagramXML from './ElementTemplates.bpmn';

const SCHEMA = 'https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json';

// host engines used for the whole suite; template engines are only enforced
// when the engine key is present here (unknown keys are treated compatible)
const ENGINES = {
  camundaDesktopModeler: '5.0.0'
};

// a valid template, compatible with the host engines
const VALID_COMPATIBLE = {
  $schema: SCHEMA,
  name: 'Valid Compatible',
  id: 'valid.compatible',
  appliesTo: [ 'bpmn:Task' ],
  properties: [
    {
      label: 'Name',
      type: 'String',
      binding: {
        type: 'property',
        name: 'name'
      }
    }
  ]
};

// a schema-INVALID template (optional not supported for property binding),
// compatible with the host engines
const INVALID_COMPATIBLE = {
  $schema: SCHEMA,
  name: 'Invalid Compatible',
  id: 'invalid.compatible',
  appliesTo: [ 'bpmn:Task' ],
  properties: [
    {
      type: 'String',
      optional: true,
      binding: {
        type: 'property',
        name: 'name'
      }
    }
  ]
};

// a schema-INVALID template that is INCOMPATIBLE with the host engines
// (requires a newer desktop modeler than the host provides)
const INVALID_INCOMPATIBLE = {
  $schema: SCHEMA,
  name: 'Invalid Incompatible',
  id: 'invalid.incompatible',
  engines: {
    camundaDesktopModeler: '>=999.0.0'
  },
  appliesTo: [ 'bpmn:Task' ],
  properties: [
    {
      type: 'String',
      optional: true,
      binding: {
        type: 'property',
        name: 'name'
      }
    }
  ]
};

// a schema-VALID template that is INCOMPATIBLE with the host engines
const VALID_INCOMPATIBLE = {
  $schema: SCHEMA,
  name: 'Valid Incompatible',
  id: 'valid.incompatible',
  engines: {
    camundaDesktopModeler: '>=999.0.0'
  },
  appliesTo: [ 'bpmn:Task' ],
  properties: []
};


describe('provider/cloud-element-templates - ElementTemplatesLoader', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  function bootstrap(templates, engines = ENGINES, xml = diagramXML) {
    return bootstrapModeler(xml, {
      container: container,
      modules: [
        coreModule,
        modelingModule,
        elementTemplatesCoreModule
      ],
      moddleExtensions: {
        zeebe: zeebeModdlePackage
      },
      elementTemplates: {
        engines,
        loadTemplates: templates
      }
    });
  }


  describe('engine-profile filtering before schema validation', function() {

    describe('engine-INCOMPATIBLE + schema-INVALID template', function() {

      beforeEach(bootstrap([ INVALID_INCOMPATIBLE ]));


      it('should be excluded without producing an error', inject(
        function(elementTemplatesLoader, elementTemplates, eventBus) {

          // given
          const errorListener = spy();

          eventBus.on('elementTemplates.errors', errorListener);

          // when
          elementTemplatesLoader.reload();

          // then
          // schema-invalid, but incompatible => its error is suppressed
          expect(errorListener).not.to.have.been.called;

          // and not loaded
          expect(elementTemplates.getAll()).to.be.empty;
        }
      ));

    });


    describe('engine-INCOMPATIBLE + schema-VALID template', function() {

      beforeEach(bootstrap([ VALID_INCOMPATIBLE ]));


      it('should load without error but be excluded from selection', inject(
        function(elementTemplatesLoader, elementTemplates, eventBus) {

          // given
          const errorListener = spy();

          eventBus.on('elementTemplates.errors', errorListener);

          // when
          elementTemplatesLoader.reload();

          // then
          // no intrusive error for a template built for another environment
          expect(errorListener).not.to.have.been.called;

          // but it is still loaded, so elements it is applied to keep working
          expect(elementTemplates.get('valid.incompatible')).to.exist;
          expect(elementTemplates.getAll()).to.have.length(1);

          // and excluded from selection (not offered as a compatible template)
          expect(elementTemplates.getLatest('valid.incompatible')).to.be.empty;
        }
      ));

    });


    describe('engine-COMPATIBLE + schema-INVALID template', function() {

      beforeEach(bootstrap([ INVALID_COMPATIBLE ]));


      it('should still report its validation error', inject(
        function(elementTemplatesLoader, elementTemplates, eventBus) {

          // given
          const errorListener = spy();

          eventBus.on('elementTemplates.errors', errorListener);

          // when
          elementTemplatesLoader.reload();

          // then
          expect(errorListener).to.have.been.called;

          const { errors } = errorListener.getCall(0).args[0];

          expect(errors).to.have.length.above(0);

          // and not loaded
          expect(elementTemplates.getAll()).to.be.empty;
        }
      ));

    });


    describe('engine-COMPATIBLE + schema-VALID template', function() {

      beforeEach(bootstrap([ VALID_COMPATIBLE ]));


      it('should load without producing an error', inject(
        function(elementTemplatesLoader, elementTemplates, eventBus) {

          // given
          const errorListener = spy();

          eventBus.on('elementTemplates.errors', errorListener);

          // when
          elementTemplatesLoader.reload();

          // then
          expect(errorListener).not.to.have.been.called;

          const loaded = elementTemplates.getAll();

          expect(loaded).to.have.length(1);
          expect(loaded[0].id).to.eql('valid.compatible');
        }
      ));

    });


    describe('malformed <engines> for a known key', function() {

      // a malformed template with a non-string range for a _known_ engine key;
      // it must not be silently treated as "incompatible" and suppressed, but
      // handed to the validator (which reports it)
      const MALFORMED_KNOWN_ENGINE = {
        $schema: SCHEMA,
        name: 'Malformed Engine',
        id: 'malformed.engine',
        engines: {
          camunda: 123
        },
        appliesTo: [ 'bpmn:Task' ],
        properties: []
      };

      beforeEach(bootstrap([]));


      it('should not be silently skipped', inject(
        function(elementTemplatesLoader, elementTemplates, eventBus) {

          // given
          const errorListener = spy();

          eventBus.on('elementTemplates.errors', errorListener);

          // when
          // host enforces the <camunda> engine key
          elementTemplates.setEngines({ camunda: '8.6.0' });
          elementTemplatesLoader.setTemplates([ MALFORMED_KNOWN_ENGINE ]);

          // then
          // it is handed to the validator (reported), not silently dropped
          expect(errorListener).to.have.been.called;
          expect(elementTemplates.getAll()).to.be.empty;
        }
      ));

    });

  });


  describe('integration: loading + error handling', function() {

    // a diagram with a task that already has VALID_INCOMPATIBLE applied
    const APPLIED_DIAGRAM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:task id="AppliedTask" zeebe:modelerTemplate="valid.incompatible" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="AppliedTask_di" bpmnElement="AppliedTask">
        <dc:Bounds x="100" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

    // templates whose <engines> have arbitrary, non-object shapes
    const MALFORMED_SHAPES = [
      {
        $schema: SCHEMA,
        name: 'Engines String',
        id: 'engines.string',
        engines: 'foo',
        appliesTo: [ 'bpmn:Task' ],
        properties: []
      },
      {
        $schema: SCHEMA,
        name: 'Engines Array',
        id: 'engines.array',
        engines: [ 1, 2 ],
        appliesTo: [ 'bpmn:Task' ],
        properties: []
      },
      {
        $schema: SCHEMA,
        name: 'Engines Null Value',
        id: 'engines.null',
        engines: { camunda: null },
        appliesTo: [ 'bpmn:Task' ],
        properties: []
      }
    ];


    describe('engine-INCOMPATIBLE template applied to an element', function() {

      // regression guard: a template that is incompatible with the host engines
      // but already applied to an element must remain resolvable, so the
      // element keeps working ("working regardless" of incompatibility). It is
      // only excluded from *selection*, never dropped from the registry.
      beforeEach(bootstrap([ VALID_INCOMPATIBLE ], ENGINES, APPLIED_DIAGRAM_XML));


      it('should still resolve for the element it is applied to', inject(
        function(elementRegistry, elementTemplates) {

          // given
          const task = elementRegistry.get('AppliedTask');

          // when
          const template = elementTemplates.get(task);

          // then
          expect(template).to.exist;
          expect(template.id).to.eql('valid.incompatible');
        }
      ));

    });


    describe('mixed templates', function() {

      beforeEach(bootstrap([
        VALID_COMPATIBLE,
        INVALID_COMPATIBLE,
        INVALID_INCOMPATIBLE,
        VALID_INCOMPATIBLE
      ]));


      it('should suppress incompatible errors but keep valid templates loaded', inject(
        function(elementTemplatesLoader, elementTemplates, eventBus) {

          // given
          const errorListener = spy();

          eventBus.on('elementTemplates.errors', errorListener);

          // when
          elementTemplatesLoader.reload();

          // then
          // only the schema-invalid _compatible_ template reports an error;
          // the schema-invalid _incompatible_ one is suppressed
          expect(errorListener).to.have.been.calledOnce;

          const { errors } = errorListener.getCall(0).args[0];

          expect(errors).to.have.length(1);

          // both schema-valid templates are loaded (compatible + incompatible),
          // so elements they are applied to keep working
          const loaded = elementTemplates.getAll().map(t => t.id).sort();

          expect(loaded).to.eql([ 'valid.compatible', 'valid.incompatible' ]);

          // but only the compatible one is offered for selection
          expect(elementTemplates.getLatest('valid.compatible')).to.have.length(1);
          expect(elementTemplates.getLatest('valid.incompatible')).to.be.empty;
        }
      ));

    });


    describe('broken / untrusted templates', function() {

      describe('malformed <engines> shapes', function() {

        beforeEach(bootstrap([ VALID_COMPATIBLE, ...MALFORMED_SHAPES ]));


        it('should not break loading of valid templates', inject(
          function(elementTemplatesLoader, elementTemplates) {

            // when
            const load = () => elementTemplatesLoader.reload();

            // then
            expect(load).not.to.throw();

            // and the valid template still loads
            const loaded = elementTemplates.getAll();

            expect(loaded.map(t => t.id)).to.include('valid.compatible');
          }
        ));

      });


      describe('non-array templates', function() {

        const loadTemplates = function(done) {
          done(null, { not: 'an array' });
        };

        beforeEach(bootstrap(loadTemplates));


        it('should report an error without throwing', inject(
          function(elementTemplatesLoader, eventBus) {

            // given
            const errorListener = spy();

            eventBus.on('elementTemplates.errors', errorListener);

            // when
            const load = () => elementTemplatesLoader.reload();

            // then
            expect(load).not.to.throw();
            expect(errorListener).to.have.been.called;
          }
        ));

      });

    });

  });

});
