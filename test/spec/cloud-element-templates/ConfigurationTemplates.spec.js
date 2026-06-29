import { expect } from 'chai';
import { spy } from 'sinon';

import {
  bootstrapModeler,
  inject
} from 'test/TestHelper';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesCoreModule from 'src/cloud-element-templates/core';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import diagramXML from './ElementTemplates.bpmn';
import connectionsDesignTemplates from './fixtures/connections-design.json';


describe('provider/cloud-element-templates - ConfigurationTemplates', function() {

  beforeEach(bootstrapModeler(diagramXML, {
    modules: [
      coreModule,
      elementTemplatesCoreModule,
      modelingModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    }
  }));


  describe('extraction', function() {

    it('should extract configuration templates when element templates are set',
      inject(function(elementTemplates, configurationTemplates) {

        // when
        elementTemplates.set(connectionsDesignTemplates);

        // then
        const all = configurationTemplates.getAll();

        expect(all).to.have.length.greaterThan(0);
        expect(all[0].id).to.equal('io.camunda:slack-connection:1');
      })
    );


    it('should update when element templates change',
      inject(function(elementTemplates, configurationTemplates) {

        // given
        elementTemplates.set(connectionsDesignTemplates);

        expect(configurationTemplates.getAll()).to.have.length.greaterThan(0);

        // when
        elementTemplates.set([]);

        // then
        expect(configurationTemplates.getAll()).to.have.length(0);
      })
    );


    it('should fire configurationTemplates.changed',
      inject(function(elementTemplates, configurationTemplates, eventBus) {

        // given
        const changedSpy = spy();

        eventBus.on('configurationTemplates.changed', changedSpy);

        // when
        elementTemplates.set(connectionsDesignTemplates);

        // then
        expect(changedSpy).to.have.been.calledOnce;
      })
    );

  });


  describe('#get', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(connectionsDesignTemplates);
    }));


    it('should get by ID (latest version)',
      inject(function(configurationTemplates) {

        // when
        const template = configurationTemplates.get('io.camunda:slack-connection:1');

        // then
        expect(template).to.exist;
        expect(template.id).to.equal('io.camunda:slack-connection:1');
      })
    );


    it('should get by ID and version',
      inject(function(configurationTemplates) {

        // when
        const template = configurationTemplates.get('io.camunda:slack-connection:1', 2);

        // then
        expect(template).to.exist;
        expect(template.version).to.equal(2);
      })
    );


    it('should return null for unknown ID',
      inject(function(configurationTemplates) {

        // when
        const template = configurationTemplates.get('unknown');

        // then
        expect(template).to.be.null;
      })
    );


    it('should return null for unknown version',
      inject(function(configurationTemplates) {

        // when
        const template = configurationTemplates.get('io.camunda:slack-connection:1', 999);

        // then
        expect(template).to.be.null;
      })
    );

  });


  describe('#getLatest', function() {

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set(connectionsDesignTemplates);
    }));


    it('should return one entry per unique ID',
      inject(function(configurationTemplates) {

        // when
        const latest = configurationTemplates.getLatest();

        // then
        const ids = latest.map(t => t.id);
        const uniqueIds = [ ...new Set(ids) ];

        expect(ids).to.deep.equal(uniqueIds);
      })
    );

  });

});
