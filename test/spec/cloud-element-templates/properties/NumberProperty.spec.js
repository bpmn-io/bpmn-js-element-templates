import TestContainer from 'mocha-test-container-support';

import {
  bootstrapPropertiesPanel,
  changeInput,
  getBpmnJS
} from 'test/TestHelper';

import {
  act,
  fireEvent
} from '@testing-library/preact';


import {
  query as domQuery
} from 'min-dom';

import { isString } from 'min-dash';

import {
  findExtension,
  findInputParameter,
  findOutputParameter,
  findZeebeProperty
} from 'src/cloud-element-templates/Helper';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { BpmnPropertiesPanelModule as BpmnPropertiesPanel } from 'bpmn-js-properties-panel';import elementTemplatesModule from 'src/cloud-element-templates';

import diagramXML from './NumberProperty.bpmn';
import templates from './NumberProperty.json';


describe('provider/cloud-element-templates - NumberProperty', function() {

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


  describe('feel disabled', function() {

    let entry, input;

    beforeEach(async function() {
      await expectSelected('disabled');
      entry = findEntry('custom-entry-numberField.feel.disabled-0', container);
      input = findInput('number', entry);
    });

    it('should render number field', async function() {

      // then
      expect(input).to.exist;
    });


    it('should be editable', async function() {

      // when
      await changeInput(input, '123');

      // then
      expectZeebeProperty('disabled', 'NumberProperty', 123);
    });


    it('should accept scientific notation', async function() {

      // when
      await changeInput(input, '1.23e100');

      // then
      const errorMessage = domQuery('.bio-properties-panel-error', entry);
      expect(errorMessage).not.to.exist;
    });

  });


  describe('no feel property - static for input and output', function() {

    let inputEntry, outputEntry;

    beforeEach(async function() {
      await expectSelected('no-feel');
      inputEntry = findEntry('custom-entry-numberField.feel.no-feel-0', container);
      outputEntry = findEntry('custom-entry-numberField.feel.no-feel-1', container);
    });

    it('should render number field', async function() {

      // then
      expect(findNumberInput(inputEntry)).to.exist;
      expect(findNumberInput(outputEntry)).to.exist;
    });


    it('should cast to FEEL expression (zeebe:input)', async function() {

      // when
      await changeInput(findNumberInput(inputEntry), '123');

      // then
      expectZeebeInput('no-feel', 'NumberProperty', '=123');
    });


    it('should cast to FEEL expression (zeebe:output)', async function() {

      // when
      await changeInput(findNumberInput(outputEntry), '123');

      // then
      expectZeebeOutput('no-feel', 'NumberProperty', '=123');
    });
  });


  describe('feel required', function() {

    let entry, input, element;

    beforeEach(async function() {
      element = await expectSelected('required');
      entry = findEntry('custom-entry-numberField.feel.required-0', container);
      input = domQuery('.bio-properties-panel-feel-editor-container', entry);
    });

    it('should render as FEEL field', async function() {

      // then
      expect(input).to.exist;

    });


    it('should be FEEL expression by default', async function() {

      // when
      // we have default value of 100 in the schema
      changeTemplate(element, templates.find(x => x.id === 'numberField.feel.required'));

      // then
      expectZeebeProperty('required', 'NumberProperty', '=100');
    });

  });


  describe('feel static', function() {

    let entry, input;

    beforeEach(async function() {
      await expectSelected('static');
      entry = findEntry('custom-entry-numberField.feel.static-0', container);
      input = findInput('number', entry);
    });

    it('should render number field', async function() {

      // then
      expect(input).to.exist;
    });


    it('should cast to FEEL expression', async function() {

      // when
      await changeInput(input, '123');

      // then
      expectZeebeProperty('static', 'NumberProperty', '=123');
    });


    it('should not accept scientific notation', async function() {

      // when
      await changeInput(input, '1.23e100');

      // then
      expectError(entry, 'Scientific notation is disallowed in FEEL.');
    });

  });


  describe('feel optional', function() {

    let entry, input, toggle;

    beforeEach(async function() {
      await expectSelected('optional');
      entry = findEntry('custom-entry-numberField.feel.optional-0', container);
      input = findInput('number', entry);
      toggle = domQuery('button.bio-properties-panel-feel-icon.optional', entry);
    });


    describe('feel disabled', function() {

      it('should render number field', async function() {

        // then
        expect(input).to.exist;
        expect(toggle).to.exist;
      });


      it('should cast to FEEL expression', async function() {

        // when
        await changeInput(input, '123');

        // then
        expectZeebeProperty('optional', 'NumberProperty', '=123');
      });


      it('should not accept scientific notation', async function() {

        // when
        await changeInput(input, '1.23e100');

        // then
        expectError(entry, 'Scientific notation is disallowed in FEEL.');
      });

    });


    describe('feel enabled', function() {

      it('should toggle to FEEL field', async function() {

        // when
        await act(() => {
          fireEvent.click(toggle);
        });

        // then
        expect(domQuery('.bio-properties-panel-feel-editor-container', entry)).to.exist;
      });


      it('should revert to number field on re-select', async function() {

        // given
        await act(() => {
          fireEvent.click(toggle);
        });

        // assume
        expect(domQuery('.bio-properties-panel-feel-editor-container', entry)).to.exist;

        // when
        await expectSelected('required');
        await expectSelected('optional');

        // then
        entry = findEntry('custom-entry-numberField.feel.optional-0', container);
        expect(findInput('number', entry)).to.exist;

      });


      it('should stay expression re-select', async function() {

        // given
        await act(() => {
          fireEvent.click(toggle);
        });

        const input = domQuery('[role="textbox"]', entry);

        // assume
        expect(domQuery('.bio-properties-panel-feel-editor-container', entry)).to.exist;

        // when
        input.textContent = 'foo';

        await expectSelected('required');
        await expectSelected('optional');

        // then
        entry = findEntry('custom-entry-numberField.feel.optional-0', container);
        expect(findInput('number', entry)).not.to.exist;
      });

    });


  });

});


// helpers //////////


function expectZeebeProperty(id, name, value) {
  return getBpmnJS().invoke(function(elementRegistry) {
    const element = elementRegistry.get(id);

    const bo = getBusinessObject(element);

    const zeebeProperties = findExtension(bo, 'zeebe:Properties'),
          zeebeProperty = findZeebeProperty(zeebeProperties, { name });

    expect(zeebeProperty).to.exist;
    expect(zeebeProperty.value).to.eql(value);
  });
}

function expectZeebeInput(id, name, value) {
  return getBpmnJS().invoke(function(elementRegistry) {
    const element = elementRegistry.get(id);

    const bo = getBusinessObject(element);

    const ioMapping = findExtension(bo, 'zeebe:IoMapping'),
          input = findInputParameter(ioMapping, { name });

    expect(input).to.exist;
    expect(input.source).to.eql(value);
  });
}

function expectZeebeOutput(id, source, value) {
  return getBpmnJS().invoke(function(elementRegistry) {
    const element = elementRegistry.get(id);

    const bo = getBusinessObject(element);

    const ioMapping = findExtension(bo, 'zeebe:IoMapping'),
          output = findOutputParameter(ioMapping, { source });

    expect(output).to.exist;
    expect(output.target).to.eql(value);
  });
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

function expectError(entry, message) {
  expect(entry).to.not.be.null;

  const errorMessage = domQuery('.bio-properties-panel-error', entry);

  const error = errorMessage && errorMessage.textContent;

  expect(error).to.equal(message);
}

function findEntry(id, container) {
  expect(container).to.not.be.null;

  return domQuery(`[data-entry-id='${ id }']`, container);
}

function findNumberInput(container) {
  return findInput('number', container);
}

function findInput(type, container) {
  expect(container).to.not.be.null;

  return domQuery(`input[type='${ type }']`, container);
}

function changeTemplate(element, newTemplate, oldTemplate) {
  const templates = [];

  newTemplate && templates.push(newTemplate);
  oldTemplate && templates.push(oldTemplate);

  return getBpmnJS().invoke(function(elementTemplates, elementRegistry) {
    if (isString(element)) {
      element = elementRegistry.get(element);
    }

    expect(element).to.exist;

    elementTemplates.set(templates);

    return elementTemplates.applyTemplate(element, newTemplate);
  });
}