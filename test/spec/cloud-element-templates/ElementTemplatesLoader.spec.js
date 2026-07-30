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

});
