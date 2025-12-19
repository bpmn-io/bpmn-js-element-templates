import { act } from '@testing-library/preact';
import { expect } from 'chai';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';
import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import { BpmnPropertiesPanelModule as BpmnPropertiesPanel } from 'bpmn-js-properties-panel';
import { query as domQuery } from 'min-dom';
import TestContainer from 'mocha-test-container-support';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import {
  bootstrapPropertiesPanel,
  changeInput,
  inject,
  getBpmnJS
} from 'test/TestHelper';

import elementTemplatesModule from 'src/cloud-element-templates';
import { findExtension } from 'src/cloud-element-templates/Helper';

import diagramXML from './CustomProperties.bindingType.bpmn';
import templates from './CustomProperties.bindingType.json';


describe('provider/cloud-element-templates - CustomProperties - binding type property', function() {
  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapPropertiesPanel(diagramXML, {
    container,
    debounceInput: false,
    elementTemplates: templates,
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    },
    modules: [
      BpmnPropertiesPanel,
      coreModule,
      elementTemplatesModule,
      modelingModule
    ]
  }));


  describe('calledDecision', function() {

    it('should display', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('BusinessRuleTask_empty');
      const template = templates.find(t => t.id === 'io.camunda.examples.Decision.BindingType');

      // when
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // then
      const entry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-2', container);
      const select = findSelect(entry);
      const options = Array.from(select.options).map(({ selected, value }) => ({ selected, value }));

      expect(entry).to.exist;
      expect(select).to.exist;
      expect(options).to.eql([
        { value: 'latest', selected: true },
        { value: 'deployment', selected: false },
        { value: 'versionTag', selected: false }
      ]);
    }));


    it('should change, setting bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('BusinessRuleTask_empty');
      const template = templates.find(t => t.id === 'io.camunda.examples.Decision.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'deployment');

      // then
      expect(select.value).to.equal('deployment');

      const calledDecision = findExtension(getBusinessObject(element), 'zeebe:CalledDecision');
      expect(calledDecision).to.exist;
      expect(calledDecision).to.have.property('bindingType', 'deployment');
      expect(calledDecision).to.not.have.property('versionTag');
    }));


    it('should change, setting versionTag', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('BusinessRuleTask_empty');
      const template = templates.find(t => t.id === 'io.camunda.examples.Decision.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      const versionTagEntry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-3', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      // then
      expect(versionInput.value).to.equal('v2');
      const calledDecision = findExtension(getBusinessObject(element), 'zeebe:CalledDecision');
      expect(calledDecision).to.exist;
      expect(calledDecision).to.have.property('bindingType', 'versionTag');
      expect(calledDecision).to.have.property('versionTag', 'v2');
    }));


    it('should change, removing versionTag when changing bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('BusinessRuleTask_empty');
      const template = templates.find(t => t.id === 'io.camunda.examples.Decision.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-3', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      changeInput(select, 'latest');

      // then
      versionTagEntry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-3', container);
      expect(versionTagEntry).to.not.exist;

      const calledDecision = findExtension(getBusinessObject(element), 'zeebe:CalledDecision');
      expect(calledDecision).to.exist;
      expect(calledDecision).to.not.have.property('bindingType', 'versionTag');
      expect(calledDecision).to.not.have.property('versionTag');
      expect(calledDecision).to.have.property('bindingType', 'latest');
    }));


    it('should remove, removing bindingType and versionTag', inject(async function(elementTemplates) {

      // given
      let element = await expectSelected('BusinessRuleTask_called_decision');
      const template = templates.find(t => t.id === 'io.camunda.examples.Decision.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.Decision.BindingType-3', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      await act(() => {
        elementTemplates.removeTemplate(element);
      });
      element = await expectSelected('BusinessRuleTask_called_decision');

      // then
      const calledDecision = findExtension(getBusinessObject(element), 'zeebe:CalledDecision');
      expect(calledDecision).to.not.exist;
    }));

  });


  describe('calledElement', function() {

    it('should display', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('CalledElement');
      const template = templates.find(t => t.id === 'io.camunda.examples.CallActivity.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // then
      const entry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-1', container);
      const select = findSelect(entry);
      const options = Array.from(select.options).map(({ selected, value }) => ({ selected, value }));

      expect(entry).to.exist;
      expect(select).to.exist;
      expect(options).to.eql([
        { value: 'latest', selected: true },
        { value: 'deployment', selected: false },
        { value: 'versionTag', selected: false }
      ]);
    }));


    it('should change, setting bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('CalledElement');
      const template = templates.find(t => t.id === 'io.camunda.examples.CallActivity.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-1', container);
      const select = findSelect(entry);
      changeInput(select, 'latest');

      // then
      expect(select.value).to.equal('latest');
      const calledElement = findExtension(getBusinessObject(element), 'zeebe:CalledElement');
      expect(calledElement).to.exist;
      expect(calledElement).to.have.property('bindingType', 'latest');
      expect(calledElement).to.not.have.property('versionTag');
    }));


    it('should change, setting versionTag', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('CalledElement');
      const template = templates.find(t => t.id === 'io.camunda.examples.CallActivity.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-1', container);
      const select = findSelect(entry);
      await act(() => {
        changeInput(select, 'versionTag');
      });

      const versionTagEntry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-2', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      // then
      expect(versionInput.value).to.equal('v2');
      const calledElement = findExtension(getBusinessObject(element), 'zeebe:CalledElement');
      expect(calledElement).to.exist;
      expect(calledElement).to.have.property('bindingType', 'versionTag');
      expect(calledElement).to.have.property('versionTag', 'v2');
    }));


    it('should change, removing versionTag when changing bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('CalledElement');
      const template = templates.find(t => t.id === 'io.camunda.examples.CallActivity.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-1', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-2', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      changeInput(select, 'latest');

      // then
      versionTagEntry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-2', container);
      expect(versionTagEntry).to.not.exist;

      const calledElement = findExtension(getBusinessObject(element), 'zeebe:CalledElement');
      expect(calledElement).to.exist;
      expect(calledElement).to.not.have.property('bindingType', 'versionTag');
      expect(calledElement).to.not.have.property('versionTag');
      expect(calledElement).to.have.property('bindingType', 'latest');
    }));


    it('should remove, removing bindingType and versionTag', inject(async function(elementTemplates) {

      // given
      let element = await expectSelected('CalledElement');
      const template = templates.find(t => t.id === 'io.camunda.examples.CallActivity.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-1', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.CallActivity.BindingType-2', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      await act(() => {
        elementTemplates.removeTemplate(element);
      });

      element = await expectSelected('CalledElement');

      // then
      const calledElement = findExtension(getBusinessObject(element), 'zeebe:CalledElement');
      expect(calledElement).to.not.exist;
    }));

  });


  describe('linkedResource', function() {

    it('should display', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('Service_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.LinkedResource.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // then
      const entry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-3', container);
      const select = findSelect(entry);
      const options = Array.from(select.options).map(({ selected, value }) => ({ selected, value }));

      expect(entry).to.exist;
      expect(select).to.exist;
      expect(options).to.eql([
        { value: 'latest', selected: true },
        { value: 'deployment', selected: false },
        { value: 'versionTag', selected: false }
      ]);
    }));


    it('should change, setting bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('Service_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.LinkedResource.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-3', container);
      const select = findSelect(entry);
      changeInput(select, 'latest');

      // then
      expect(select.value).to.equal('latest');
      const linkedResources = findExtension(getBusinessObject(element), 'zeebe:LinkedResources');
      expect(linkedResources.values).to.have.length(1);
      const linkedResource = linkedResources.values[0];
      expect(linkedResource).to.have.property('bindingType', 'latest');
      expect(linkedResource).to.not.have.property('versionTag');
    }));


    it('should change, setting versionTag', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('Service_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.LinkedResource.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-3', container);
      const select = findSelect(entry);
      await act(() => {
        changeInput(select, 'versionTag');
      });

      const versionTagEntry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-4', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      // then
      expect(versionInput.value).to.equal('v2');
      const linkedResources = findExtension(getBusinessObject(element), 'zeebe:LinkedResources');
      expect(linkedResources.values).to.have.length(1);
      const linkedResource = linkedResources.values[0];
      expect(linkedResource).to.have.property('bindingType', 'versionTag');
      expect(linkedResource).to.have.property('versionTag', 'v2');
    }));


    it('should change, removing versionTag when changing bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('Service_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.LinkedResource.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-3', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-4', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      changeInput(select, 'latest');

      // then
      versionTagEntry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-4', container);
      expect(versionTagEntry).to.not.exist;

      const linkedResources = findExtension(getBusinessObject(element), 'zeebe:LinkedResources');
      expect(linkedResources.values).to.have.length(1);
      const linkedResource = linkedResources.values[0];
      expect(linkedResource).to.not.have.property('bindingType', 'versionTag');
      expect(linkedResource).to.not.have.property('versionTag');
      expect(linkedResource).to.have.property('bindingType', 'latest');
    }));


    it('should remove, removing bindingType and versionTag', inject(async function(elementTemplates) {

      // given
      let element = await expectSelected('Service_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.LinkedResource.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-3', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.LinkedResource.BindingType-4', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      await act(() => {
        elementTemplates.removeTemplate(element);
      });

      element = await expectSelected('Service_Task');

      const linkedResources = findExtension(getBusinessObject(element), 'zeebe:LinkedResources');
      expect(linkedResources).to.not.exist;
    }));

  });

  describe('formDefinition', function() {

    it('should display', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('User_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.FormDefinition.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // then
      const entry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-2', container);
      const select = findSelect(entry);
      const options = Array.from(select.options).map(({ selected, value }) => ({ selected, value }));

      expect(entry).to.exist;
      expect(select).to.exist;
      expect(options).to.eql([
        { value: 'latest', selected: true },
        { value: 'deployment', selected: false },
        { value: 'versionTag', selected: false }
      ]);
    }));


    it('should change, setting bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('User_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.FormDefinition.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'latest');

      // then
      expect(select.value).to.equal('latest');
      const formDefinition = findExtension(getBusinessObject(element), 'zeebe:FormDefinition');
      expect(formDefinition).to.exist;
      expect(formDefinition).to.have.property('bindingType', 'latest');
      expect(formDefinition).to.not.have.property('versionTag');
    }));


    it('should change, setting versionTag', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('User_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.FormDefinition.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-2', container);
      const select = findSelect(entry);
      await act(() => {
        changeInput(select, 'versionTag');
      });

      const versionTagEntry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-3', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      // then
      expect(versionInput.value).to.equal('v2');
      const formDefinition = findExtension(getBusinessObject(element), 'zeebe:FormDefinition');
      expect(formDefinition).to.exist;
      expect(formDefinition).to.have.property('bindingType', 'versionTag');
      expect(formDefinition).to.have.property('versionTag', 'v2');
    }));


    it('should change, removing versionTag when changing bindingType', inject(async function(elementTemplates) {

      // given
      const element = await expectSelected('User_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.FormDefinition.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-3', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      changeInput(select, 'latest');

      // then
      versionTagEntry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-3', container);
      expect(versionTagEntry).to.not.exist;

      const formDefinition = findExtension(getBusinessObject(element), 'zeebe:FormDefinition');
      expect(formDefinition).to.exist;
      expect(formDefinition).to.not.have.property('bindingType', 'versionTag');
      expect(formDefinition).to.not.have.property('versionTag');
      expect(formDefinition).to.have.property('bindingType', 'latest');
    }));


    it('should remove, removing bindingType and versionTag', inject(async function(elementTemplates) {

      // given
      let element = await expectSelected('User_Task');
      const template = templates.find(t => t.id === 'io.camunda.examples.FormDefinition.BindingType');
      await act(() => {
        elementTemplates.applyTemplate(element, template);
      });

      // when
      const entry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-2', container);
      const select = findSelect(entry);
      changeInput(select, 'versionTag');

      let versionTagEntry = findEntry('custom-entry-io.camunda.examples.FormDefinition.BindingType-3', container);
      const versionInput = findInput('text', versionTagEntry);
      changeInput(versionInput, 'v2');

      await act(() => {
        elementTemplates.removeTemplate(element);
      });

      element = await expectSelected('User_Task');

      // then
      const formDefinition = findExtension(getBusinessObject(element), 'zeebe:FormDefinition');
      expect(formDefinition).to.not.exist;
    }));

  });

});

// helpers //////////

function findEntry(id, container) {
  expect(container).to.not.be.null;

  return domQuery(`[data-entry-id='${id}']`, container);
}

function findInput(type, container) {
  expect(container).to.not.be.null;

  return domQuery(`input[type='${type}']`, container);
}

function findSelect(container) {
  expect(container).to.not.be.null;

  return domQuery('select', container);
}

function expectSelected(id) {
  return getBpmnJS().invoke(async function(elementRegistry, selection) {
    const element = elementRegistry.get(id);

    await act(() => {
      selection.select(element);
    });

    return element;
  });
}
