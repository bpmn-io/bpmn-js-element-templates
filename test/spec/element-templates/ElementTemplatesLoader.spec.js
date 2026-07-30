import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';
import { spy } from 'sinon';

import { bootstrapModeler, inject } from 'test/TestHelper';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesModule from 'src/element-templates';
import modelingModule from 'bpmn-js/lib/features/modeling';
import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';

import camundaModdlePackage from 'camunda-bpmn-moddle/resources/camunda';

import diagramXML from './fixtures/empty-diagram.bpmn';

import templateDescriptors from './fixtures/misc';


const modules = [
  coreModule,
  modelingModule,
  BpmnPropertiesPanelModule,
  elementTemplatesModule,
  {
    propertiesPanel: [ 'value', { registerProvider() {} } ]
  }
];


describe('provider/element-templates - ElementTemplatesLoader', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });


  describe('init with config={ loadTemplates } as Array<TemplateDescriptor>', function() {

    beforeEach(bootstrapModeler(diagramXML, {
      container: container,
      modules,
      moddleExtensions: {
        camunda: camundaModdlePackage
      },
      elementTemplates: {
        loadTemplates: templateDescriptors
      }
    }));

    it('should configure elementTemplates service', inject(function(elementTemplates) {

      // then
      expect(elementTemplates.getAll()).to.eql(templateDescriptors);
    }));

  });


  describe('init with config={ loadTemplates } as function', function() {

    let provider = function(done) {
      done(null, templateDescriptors);
    };

    const templateProviderFn = function(done) {
      provider(done);
    };

    beforeEach(bootstrapModeler(diagramXML, {
      container: container,
      modules,
      moddleExtensions: {
        camunda: camundaModdlePackage
      },
      elementTemplates: {
        loadTemplates: templateProviderFn
      }
    }));

    it('should configure elementTemplates service', inject(function(elementTemplates) {

      // then
      expect(elementTemplates.getAll()).to.eql(templateDescriptors);
    }));

  });


  describe('init with Array<TemplateDescriptor>', function() {

    beforeEach(bootstrapModeler(diagramXML, {
      container: container,
      modules,
      moddleExtensions: {
        camunda: camundaModdlePackage
      },
      elementTemplates: templateDescriptors
    }));


    it('should configure elementTemplates service', inject(function(elementTemplates) {

      // then
      expect(elementTemplates.getAll()).to.eql(templateDescriptors);
    }));


    it('should emit <elementTemplates.changed> event', inject(function(elementTemplatesLoader, eventBus) {

      // given
      const changedListener = spy(function() {});

      eventBus.on('elementTemplates.changed', changedListener);

      // when
      elementTemplatesLoader.reload();

      // then
      expect(changedListener).to.have.been.called;
    }));

  });


  describe('init with node style callback', function() {

    let provider = function(done) {
      done(null, templateDescriptors);
    };

    const templateProviderFn = function(done) {
      provider(done);
    };

    beforeEach(bootstrapModeler(diagramXML, {
      container: container,
      modules,
      moddleExtensions: {
        camunda: camundaModdlePackage
      },
      elementTemplates: templateProviderFn
    }));


    it('should configure elementTemplates service',
      inject(function(elementTemplates) {

        // then
        expect(elementTemplates.getAll()).to.eql(templateDescriptors);
      })
    );


    it('should emit <elementTemplates.changed> event',
      inject(function(elementTemplatesLoader, eventBus) {

        // given
        const changedListener = spy(function() {});

        eventBus.on('elementTemplates.changed', changedListener);

        // when
        elementTemplatesLoader.reload();

        // then
        expect(changedListener).to.have.been.called;
      })
    );


    it('should NOT emit <elementTemplates.errors> event',
      inject(function(elementTemplatesLoader, eventBus) {

        // given
        const errorListener = spy();

        eventBus.on('elementTemplates.errors', errorListener);

        // when
        elementTemplatesLoader.reload();

        // then
        expect(errorListener).not.to.have.been.called;
      })
    );


    it('should handle templates load errors', inject(
      function(elementTemplatesLoader, eventBus) {

        // given
        provider = function(done) {
          done(new Error('foo'));
        };

        const errorListener = spy(function(e) {

          const errors = e.errors;

          expect(errors).to.have.length(1);

          expect(errors[0].message).to.eql('foo');
        });

        const changedListener = spy(function() {});

        eventBus.on('elementTemplates.errors', errorListener);
        eventBus.on('elementTemplates.changed', changedListener);

        // when
        elementTemplatesLoader.reload();

        // then
        expect(errorListener).to.have.been.called;
        expect(changedListener).not.to.have.been.called;
      })
    );


    it('should handle templates validation error',
      inject(function(elementTemplatesLoader, eventBus) {

        // given
        provider = function(done) {
          done(null, [
            { name: 'Foo', id: 'foo', appliesTo: [ 'bpmn:Task' ], properties: [ ] },
            { name: 'Foo', id: 'foo' },
            { name: 'Foo', id: 'foo' }
          ]);
        };

        const errorListener = spy(function(e) {

          const errors = e.errors;

          expect(messages(errors)).to.eql([
            'template(id: <foo>, name: <Foo>): template id <foo> already used',
            'template(id: <foo>, name: <Foo>): template id <foo> already used'
          ]);
        });

        const changedListener = spy(function() {});

        eventBus.on('elementTemplates.errors', errorListener);
        eventBus.on('elementTemplates.changed', changedListener);

        // when
        elementTemplatesLoader.reload();

        // then
        expect(errorListener).to.have.been.called;
        expect(changedListener).to.have.been.called;

      })
    );

  });


  describe('engine-profile filtering before schema validation', function() {

    // host provides an old desktop modeler; template <engines> are only
    // enforced for engine keys present here (unknown keys stay compatible)
    const engines = {
      camundaDesktopModeler: '5.0.0'
    };

    // schema-valid, compatible
    const validCompatible = {
      name: 'Valid Compatible',
      id: 'valid.compatible',
      appliesTo: [ 'bpmn:Task' ],
      properties: []
    };

    // schema-INVALID (missing properties), compatible
    const invalidCompatible = {
      name: 'Invalid Compatible',
      id: 'invalid.compatible',
      appliesTo: [ 'bpmn:Task' ]
    };

    // schema-INVALID (missing properties), incompatible with the host engines
    const invalidIncompatible = {
      name: 'Invalid Incompatible',
      id: 'invalid.incompatible',
      engines: {
        camundaDesktopModeler: '>=999.0.0'
      },
      appliesTo: [ 'bpmn:Task' ]
    };

    // schema-VALID, incompatible with the host engines
    const validIncompatible = {
      name: 'Valid Incompatible',
      id: 'valid.incompatible',
      engines: {
        camundaDesktopModeler: '>=999.0.0'
      },
      appliesTo: [ 'bpmn:Task' ],
      properties: []
    };

    function bootstrap(templates) {
      return bootstrapModeler(diagramXML, {
        container: container,
        modules,
        moddleExtensions: {
          camunda: camundaModdlePackage
        },
        elementTemplates: {
          engines,
          loadTemplates: templates
        }
      });
    }


    describe('engine-INCOMPATIBLE + schema-INVALID template', function() {

      beforeEach(bootstrap([ invalidIncompatible ]));


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


    describe('engine-COMPATIBLE + schema-INVALID template', function() {

      beforeEach(bootstrap([ invalidCompatible ]));


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
          expect(elementTemplates.getAll()).to.be.empty;
        }
      ));

    });


    describe('engine-COMPATIBLE + schema-VALID template', function() {

      beforeEach(bootstrap([ validCompatible ]));


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


    describe('engine-INCOMPATIBLE + schema-VALID template', function() {

      beforeEach(bootstrap([ validIncompatible ]));


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

  });

});


// helpers ////////////////////////////

function messages(errors) {
  return errors.map(function(e) {
    return e.message;
  });
}
