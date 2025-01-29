import TestContainer from 'mocha-test-container-support';

import {
  bootstrapPropertiesPanel,
  getBpmnJS
} from 'test/TestHelper';

import {
  act,
  fireEvent
} from '@testing-library/preact';


import {
  query as domQuery
} from 'min-dom';

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

import diagramXML from './BooleanProperty.bpmn';
import templates from './BooleanProperty.json';


describe('provider/cloud-element-templates - BooleanProperty', function() {

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
      entry = findEntry('custom-entry-booleanField.feel.disabled-0', container);
      input = findInput('checkbox', entry);
    });

    it('should render boolean field', async function() {

      // then
      expect(input).to.exist;
    });


    it('should be editable', async function() {

      // when
      await input.click();

      // then
      expectZeebeProperty('disabled', 'BooleanProperty', true);
    });

  });


  describe('no feel property - static for zeebe:input and zeebe:output', function() {

    let inputEntry, outputEntry;

    beforeEach(async function() {
      await expectSelected('no-feel');
      inputEntry = findEntry('custom-entry-booleanField.feel.no-feel-0', container);
      outputEntry = findEntry('custom-entry-booleanField.feel.no-feel-1', container);
    });

    it('should render boolean field', async function() {

      // then
      expect(findCheckbox(inputEntry)).to.exist;
      expect(findCheckbox(outputEntry)).to.exist;
    });


    it('should cast to FEEL expression as in static (zeebe:input)', async function() {

      // when
      await findCheckbox(inputEntry).click();

      // then
      expectZeebeInput('no-feel', 'BooleanProperty', '=true');
    });


    it('should cast to FEEL expression as in static (zeebe:output)', async function() {

      // when
      await findCheckbox(outputEntry).click();

      // then
      expectZeebeOutput('no-feel', 'BooleanProperty', '=true');
    });
  });


  describe('feel required', function() {

    let entry, input;

    beforeEach(async function() {
      await expectSelected('required');
      entry = findEntry('custom-entry-booleanField.feel.required-0', container);
      input = domQuery('.bio-properties-panel-feel-editor-container', entry);
    });

    it('should render as FEEL field', async function() {

      // then
      expect(input).to.exist;

    });

  });


  describe('feel static', function() {

    let entry, input;

    beforeEach(async function() {
      await expectSelected('static');
      entry = findEntry('custom-entry-booleanField.feel.static-0', container);
      input = findInput('checkbox', entry);
    });

    it('should render boolean field', async function() {

      // then
      expect(input).to.exist;
    });


    it('should cast to FEEL expression', async function() {

      // when
      await input.click();

      // then
      expectZeebeProperty('static', 'BooleanProperty', '=true');
    });

  });


  describe('feel optional', function() {

    let entry, input, toggle;

    beforeEach(async function() {
      await expectSelected('optional');
      entry = findEntry('custom-entry-booleanField.feel.optional-0', container);
      input = findInput('checkbox', entry);
      toggle = domQuery('button.bio-properties-panel-feel-icon.optional', entry);
    });


    describe('feel disabled', function() {

      it('should render boolean field', async function() {

        // then
        expect(input).to.exist;
        expect(toggle).to.exist;
      });


      it('should cast to FEEL expression', async function() {

        // when
        await input.click();

        // then
        expectZeebeProperty('optional', 'BooleanProperty', '=true');
      });

    });


    describe('feel enabled', function() {

      it('should toggle to FEEL field', async function() {

        // when
        await act(() => {
          toggle.click();
        });

        // then
        expect(domQuery('.bio-properties-panel-feel-entry', container)).to.exist;
      });


      it('should revert to boolean field on re-select', async function() {

        // given
        await act(() => {
          fireEvent.click(toggle);
        });

        // assume
        expect(domQuery('.bio-properties-panel-feel-entry', container)).to.exist;

        // when
        await expectSelected('required');
        await expectSelected('optional');

        // then
        entry = findEntry('custom-entry-booleanField.feel.optional-0', container);
        expect(findInput('checkbox', entry)).to.exist;

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
        entry = findEntry('custom-entry-booleanField.feel.optional-0', container);
        expect(findInput('checkbox', entry)).not.to.exist;
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


function findEntry(id, container) {
  expect(container).to.not.be.null;

  return domQuery(`[data-entry-id='${ id }']`, container);
}

function findInput(type, container) {
  expect(container).to.not.be.null;

  return domQuery(`input[type='${ type }']`, container);
}

function findCheckbox(container) {
  return findInput('checkbox', container);
}
