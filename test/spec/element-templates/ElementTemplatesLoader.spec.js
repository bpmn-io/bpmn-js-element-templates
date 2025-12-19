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
        const errorListener = spy(function() {
          console.log(arguments);
        });

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

});


// helpers ////////////////////////////

function messages(errors) {
  return errors.map(function(e) {
    return e.message;
  });
}
