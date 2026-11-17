import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';
import { spy } from 'sinon';

import { act } from '@testing-library/preact';

import {
  query as domQuery,
  queryAll as domQueryAll
} from 'min-dom';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe.json';

import {
  bootstrapPropertiesPanel,
  clickInput as click,
  inject
} from 'test/TestHelper';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';

import elementTemplatesModule from 'src/cloud-element-templates';

import {
  findExtension,
  findInputParameter,
  findTaskHeader
} from 'src/cloud-element-templates/Helper';

import diagramXML from './diagram.bpmn';
import templates from './templates.json';

const [ legacyTemplate, targetTemplate ] = templates;


describe('provider/cloud-element-templates - migration', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapPropertiesPanel(diagramXML, {
    container,
    modules: [
      BpmnPropertiesPanelModule,
      coreModule,
      BpmnPropertiesProviderModule,
      ZeebePropertiesProviderModule,
      elementTemplatesModule,
      modelingModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    },
    debounceInput: false,
    elementTemplates: templates
  }));


  describe('migrate', function() {

    it('should move hinted value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getInput(element, 'endpoint')).to.eql('https://custom.io');
      expect(getInput(element, 'url')).not.to.exist;
    }));


    it('should map hinted value', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getHeader(element, 'method')).to.eql('post');
    }));


    it('should move value to property activated by migration', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getInput(element, 'body')).to.eql('=payload');
    }));


    it('should keep value of unchanged binding', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(getInput(element, 'timeout')).to.eql('PT1M');
    }));


    it('should not migrate from template that is not loaded', inject(function(elementRegistry, elementTemplates) {

      // when
      const element = elementTemplates.applyTemplate(elementRegistry.get('Unknown'), targetTemplate);

      // then
      expect(getInput(element, 'endpoint')).to.eql('https://example.com');
    }));


    it('should undo in one step', inject(function(elementRegistry, elementTemplates, commandStack) {

      // given
      elementTemplates.applyTemplate(elementRegistry.get('Legacy'), targetTemplate);

      // when
      commandStack.undo();

      // then
      const element = elementRegistry.get('Legacy');

      expect(elementTemplates.get(element)).to.equal(legacyTemplate);
      expect(getInput(element, 'url')).to.eql('https://custom.io');
      expect(getInput(element, 'endpoint')).not.to.exist;
      expect(getHeader(element, 'method')).to.eql('POST');
    }));

  });


  describe('#getMigrations', function() {

    it('should return declared migration', inject(function(elementRegistry, elementTemplates) {

      // when
      const migrations = elementTemplates.getMigrations(elementRegistry.get('Legacy'));

      // then
      expect(migrations).to.eql([ targetTemplate ]);
    }));


    it('should return nothing for template that is not loaded', inject(function(elementRegistry, elementTemplates) {

      // when
      const migrations = elementTemplates.getMigrations(elementRegistry.get('Unknown'));

      // then
      expect(migrations).to.be.empty;
    }));


    it('should return nothing for migration target', inject(function(elementRegistry, elementTemplates) {

      // when
      const migrations = elementTemplates.getMigrations(elementRegistry.get('Current'));

      // then
      expect(migrations).to.be.empty;
    }));

  });


  describe('#getChanges', function() {

    it('should return migration changes', inject(function(elementRegistry, elementTemplates) {

      // when
      const changes = elementTemplates.getChanges(elementRegistry.get('Legacy'), targetTemplate);

      // then
      expect(changes).to.eql(targetTemplate.migratesFrom[0].changes);
    }));


    it('should return nothing for update', inject(function(elementRegistry, elementTemplates) {

      // when
      const changes = elementTemplates.getChanges(elementRegistry.get('Current'), targetTemplate);

      // then
      expect(changes).not.to.exist;
    }));

  });


  describe('properties panel', function() {

    it('should offer migration', inject(async function(elementRegistry, selection) {

      // when
      await act(() => selection.select(elementRegistry.get('Legacy')));

      // then
      const button = domQuery('.bio-properties-panel-template-migration-available', container);

      expect(button).to.exist;

      const text = domQuery('.bio-properties-panel-template-migration-available-text', button);

      expect(text.textContent).to.eql('Migration to REST connector is available.');
    }));


    it('should request changes review', inject(async function(elementRegistry, selection, eventBus) {

      // given
      const element = elementRegistry.get('Legacy');

      const reviewSpy = spy();

      eventBus.on('elementTemplates.reviewChanges', reviewSpy);

      await act(() => selection.select(element));

      // when
      await clickMenuItem(container, 'Review changes');

      // then
      expect(reviewSpy).to.have.been.calledOnce;
      expect(reviewSpy.getCall(0).args[0]).to.include({
        element,
        newTemplate: targetTemplate,
        changes: targetTemplate.migratesFrom[0].changes
      });
    }));


    it('should migrate', inject(async function(elementRegistry, selection, elementTemplates) {

      // given
      await act(() => selection.select(elementRegistry.get('Legacy')));

      // when
      await clickMenuItem(container, 'Migrate');

      // then
      const element = elementRegistry.get('Legacy');

      expect(elementTemplates.get(element)).to.equal(targetTemplate);
      expect(getInput(element, 'endpoint')).to.eql('https://custom.io');
      expect(domQuery('.bio-properties-panel-template-migration-available', container)).not.to.exist;
    }));

  });

});


// helpers //////////

function getInput(element, name) {
  const ioMapping = findExtension(element, 'zeebe:IoMapping');

  return ioMapping && findInputParameter(ioMapping, { name })?.get('source');
}

function getHeader(element, key) {
  const taskHeaders = findExtension(element, 'zeebe:TaskHeaders');

  return taskHeaders && findTaskHeader(taskHeaders, { key })?.get('value');
}

function clickMenuItem(container, text) {
  const item = Array.from(domQueryAll('.bio-properties-panel-dropdown-button__menu-item', container))
    .find(item => item.textContent === text);

  if (!item) {
    throw new Error(`menu item <${ text }> missing`);
  }

  return click(item);
}
