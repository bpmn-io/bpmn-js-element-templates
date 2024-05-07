import TestContainer from 'mocha-test-container-support';

import {
  bootstrapPropertiesPanel,
  changeInput,
  getBpmnJS,
  withPropertiesPanel,
  inject
} from 'test/TestHelper';

import {
  act,
  cleanup,
  fireEvent
} from '@testing-library/preact';

import {
  map
} from 'min-dash';

import {
  classes as domClasses,
  query as domQuery,
  queryAll as domQueryAll
} from 'min-dom';

import {
  findExtension,
  findInputParameter,
  findMessage,
  findOutputParameter,
  findTaskHeader,
  findZeebeProperty,
  findZeebeSubscription
} from 'src/cloud-element-templates/Helper';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { BpmnPropertiesPanelModule as BpmnPropertiesPanel } from 'bpmn-js-properties-panel';import elementTemplatesModule from 'src/cloud-element-templates';

import diagramXML from './CustomProperties.bpmn';
import templates from './CustomProperties.json';

import descriptionDiagramXML from './CustomProperties.description.bpmn';
import descriptionElementTemplates from './CustomProperties.description.json';

import tooltipDiagramXML from './CustomProperties.tooltip.bpmn';
import tooltipElementTemplates from './CustomProperties.tooltip.json';

import editableDiagramXML from './CustomProperties.editable.bpmn';
import editableElementTemplates from './CustomProperties.editable.json';

import feelDiagramXML from './CustomProperties.feel.bpmn';
import feelElementTemplates from './CustomProperties.feel.json';

import defaultTypesDiagramXML from './CustomProperties.default-types.bpmn';
import defaultTypesElementTemplates from './CustomProperties.default-types.json';

import defaultValuesDiagramXML from './CustomProperties.default-values.bpmn';
import defaultValuesElementTemplates from './CustomProperties.default-values.json';

import groupsDiagramXML from './CustomProperties.groups.bpmn';
import groupsElementTemplates from './CustomProperties.groups.json';

import textLanguageDiagramXML from './CustomProperties.text-language.bpmn';
import textLanguageElementTemplates from './CustomProperties.text-language.json';


describe('provider/cloud-element-templates - CustomProperties', function() {

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


  describe('property', function() {

    it('should display', async function() {

      // when
      await expectSelected('Task_1');

      // then
      const entry = findEntry('custom-entry-my.example.template-0', container);

      expect(entry).to.exist;

      const input = findInput('text', entry);

      expect(input).to.exist;
      expect(input.value).to.equal('My task');
    });


    it('should change', async function() {

      // given
      const task = await expectSelected('Task_1'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-my.example.template-0', container),
            input = findInput('text', entry);

      changeInput(input, 'foo');

      // then
      expect(input.value).to.equal('foo');
      expect(businessObject.get('name')).to.equal('foo');
    });


    it('should change String property to empty string when erased', async function() {

      // given
      const task = await expectSelected('Task_1'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-my.example.template-0', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      expect(input.value).to.eql('');
      expect(businessObject.get('name')).to.be.eql('');
    });

  });


  describe('zeebe:taskDefinition:type', function() {

    it('should display', async function() {

      // when
      await expectSelected('RestTask');

      // then
      const entry = findEntry('custom-entry-com.example.rest-0', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('task-type');
    });


    it('should NOT display (type=hidden)', async function() {

      // when
      await expectSelected('RestTask_hidden');

      // then
      const entry = findEntry('custom-entry-com.example.rest-hidden-0', container);

      expect(entry).to.not.exist;
    });


    it('should change, setting zeebe:TaskDefinition#type (plain)', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-0', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

      expect(taskDefinition).to.exist;
      expect(taskDefinition).to.jsonEqual({
        $type: 'zeebe:TaskDefinition',
        type: 'foo@bar'
      });
    }));


    it('should change, creating zeebe:TaskDefinition if non-existing', async function() {

      // given
      const task = await expectSelected('RestTask_noData'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-0', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

      // then
      expect(taskDefinition).to.exist;
      expect(taskDefinition).to.jsonEqual({
        $type: 'zeebe:TaskDefinition',
        type: 'foo@bar'
      });
    });

  });


  describe('zeebe:taskDefinition', function() {

    it('should display', async function() {

      // when
      await expectSelected('TaskDefinition');

      // then
      const entry = findEntry('custom-entry-taskDefinitionTemplate-0', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('http');
    });


    it('should change value', async function() {

      // given
      const task = await expectSelected('TaskDefinition'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-taskDefinitionTemplate-0', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

      // then
      expect(taskDefinition).to.exist;
      expect(taskDefinition).to.jsonEqual({
        $type: 'zeebe:TaskDefinition',
        type: 'foo@bar',
        retries: '5'
      });
    });

  });


  describe('zeebe:input', function() {

    it('should display', async function() {

      // when
      await expectSelected('RestTask');

      // then
      const entry = findEntry('custom-entry-com.example.rest-3', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('input-1-source');
    });


    it('should display empty (optional)', async function() {

      // when
      await expectSelected('RestTask_optional');

      // then
      const entry = findEntry('custom-entry-com.example.rest-optional-2', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('');
    });


    it('should change, setting zeebe:Input (plain)', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-3', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            inputParameter = findInputParameter(ioMapping, { name: 'input-1-target' });

      expect(inputParameter).to.exist;
      expect(inputParameter).to.jsonEqual({
        $type: 'zeebe:Input',
        source: 'foo@bar',
        target: 'input-1-target'
      });
    }));


    it('should change, creating zeebe:Input if non-existing', async function() {

      // given
      const task = await expectSelected('RestTask_noData'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-3', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            inputParameter = findInputParameter(ioMapping, { name: 'input-1-target' });

      // then
      expect(inputParameter).to.exist;
      expect(inputParameter).to.jsonEqual({
        $type: 'zeebe:Input',
        source: 'foo@bar',
        target: 'input-1-target'
      });
    });


    it('should keep input (non optional)', inject(async function() {

      // given
      const task = await expectSelected('RestTask_optional'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-optional-0', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            inputParameter = findInputParameter(ioMapping, { name: 'input-1-target' });

      expect(inputParameter).to.exist;
      expect(inputParameter).to.jsonEqual({
        $type: 'zeebe:Input',
        source: undefined,
        target: 'input-1-target'
      });
    }));


    it('should not keep input (optional)', inject(async function() {

      // given
      const task = await expectSelected('RestTask_optional'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-optional-1', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            inputParameter = findInputParameter(ioMapping, { name: 'input-2-target' });

      expect(inputParameter).to.not.exist;
    }));

  });


  describe('zeebe:output', function() {

    it('should display', async function() {

      // when
      await expectSelected('RestTask');

      // then
      const entry = findEntry('custom-entry-com.example.rest-5', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('output-1-target');
    });


    it('should display empty (optional)', async function() {

      // when
      await expectSelected('RestTask_optional');

      // then
      const entry = findEntry('custom-entry-com.example.rest-optional-5', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('');
    });


    it('should change, setting zeebe:Output (plain)', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-5', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            outputParameter = findOutputParameter(ioMapping, { source: 'output-1-source' });

      expect(outputParameter).to.exist;
      expect(outputParameter).to.jsonEqual({
        $type: 'zeebe:Output',
        source: 'output-1-source',
        target: 'foo@bar'
      });
    }));


    it('should change, creating zeebe:Output if non-existing', async function() {

      // given
      const task = await expectSelected('RestTask_noData'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-5', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            outputParameter = findOutputParameter(ioMapping, { source: 'output-1-source' });

      // then
      expect(outputParameter).to.exist;
      expect(outputParameter).to.jsonEqual({
        $type: 'zeebe:Output',
        source: 'output-1-source',
        target: 'foo@bar'
      });
    });


    it('should keep output (non optional)', inject(async function() {

      // given
      const task = await expectSelected('RestTask_optional'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-optional-3', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            outputParameter = findOutputParameter(ioMapping, { source: 'output-1-source' });

      expect(outputParameter).to.exist;
      expect(outputParameter).to.jsonEqual({
        $type: 'zeebe:Output',
        source: 'output-1-source',
        target: undefined
      });
    }));


    it('should NOT keep output (optional)', inject(async function() {

      // given
      const task = await expectSelected('RestTask_optional'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-optional-4', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const ioMapping = findExtension(businessObject, 'zeebe:IoMapping'),
            outputParameter = findOutputParameter(ioMapping, { source: 'output-2-source' });

      expect(outputParameter).to.not.exist;
    }));

  });


  describe('zeebe:taskHeader', function() {

    it('should display', async function() {

      // when
      await expectSelected('RestTask');

      // then
      const entry = findEntry('custom-entry-com.example.rest-1', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('header-1-value');
    });


    it('should change, setting zeebe:Header (plain)', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-1', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders'),
            header = findTaskHeader(taskHeaders, { key: 'header-1-key' });

      expect(header).to.exist;
      expect(header).to.jsonEqual({
        $type: 'zeebe:Header',
        key: 'header-1-key',
        value: 'foo@bar'
      });
    }));


    it('should change, creating zeebe:Header if non-existing', async function() {

      // given
      const task = await expectSelected('RestTask_noData'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-1', container),
            input = findInput('text', entry);

      changeInput(input, 'foo@bar');

      // then
      const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders'),
            header = findTaskHeader(taskHeaders, { key: 'header-1-key' });

      // then
      expect(header).to.exist;
      expect(header).to.jsonEqual({
        $type: 'zeebe:Header',
        key: 'header-1-key',
        value: 'foo@bar'
      });
    });


    it('should remove if empty value', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-1', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders'),
            header = findTaskHeader(taskHeaders, { key: 'header-1-key' });

      expect(header).not.to.exist;
    }));

  });


  describe('zeebe:property', function() {

    it('should display', async function() {

      // when
      await expectSelected('RestTask');

      // then
      const entry = findEntry('custom-entry-com.example.rest-7', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('property-1-value');
    });


    it('should change, setting zeebe:Property (plain)', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-7', container),
            input = findInput('text', entry);

      changeInput(input, 'property-1-changed-value');

      // then
      const zeebeProperties = findExtension(businessObject, 'zeebe:Properties'),
            zeebeProperty = findZeebeProperty(zeebeProperties, { name: 'property-1-name' });

      expect(zeebeProperty).to.exist;
      expect(zeebeProperty).to.jsonEqual({
        $type: 'zeebe:Property',
        name: 'property-1-name',
        value: 'property-1-changed-value'
      });
    }));


    it('should change, creating zeebe:Property if non-existing', async function() {

      // given
      const task = await expectSelected('RestTask_noData'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-7', container),
            input = findInput('text', entry);

      changeInput(input, 'property-1-changed-value');

      // then
      const zeebeProperties = findExtension(businessObject, 'zeebe:Properties'),
            zeebeProperty = findZeebeProperty(zeebeProperties, { name: 'property-1-name' });

      // then
      expect(zeebeProperty).to.exist;
      expect(zeebeProperty).to.jsonEqual({
        $type: 'zeebe:Property',
        name: 'property-1-name',
        value: 'property-1-changed-value'
      });
    });


    it('should keep property (non optional)', inject(async function() {

      // given
      const task = await expectSelected('RestTask'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-7', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const zeebeProperties = findExtension(businessObject, 'zeebe:Properties'),
            zeebeProperty = findZeebeProperty(zeebeProperties, { name: 'property-1-name' });

      expect(zeebeProperty).to.exist;
      expect(zeebeProperty).to.jsonEqual({
        $type: 'zeebe:Property',
        name: 'property-1-name',
        value: ''
      });
    }));


    it('should not keep property (optional)', inject(async function() {

      // given
      const task = await expectSelected('RestTask_optional'),
            businessObject = getBusinessObject(task);

      // when
      const entry = findEntry('custom-entry-com.example.rest-optional-8', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const zeebeProperties = findExtension(businessObject, 'zeebe:Properties'),
            zeebeProperty = findZeebeProperty(zeebeProperties, { name: 'property-3-name' });

      // then
      expect(zeebeProperty).not.to.exist;
    }));

  });


  describe('bpmn:Message#property', function() {


    it('should display', async function() {

      // when
      await expectSelected('MessageEvent');

      // then
      const entry = findEntry('custom-entry-messageEventTemplate-0', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('name');
    });


    it('should NOT display (type=hidden)', async function() {

      // when
      await expectSelected('MessageEvent_hidden');

      // then
      const entry = findEntry('custom-entry-messageEventTemplate_hidden-0', container);

      expect(entry).to.not.exist;
    });


    it('should change, setting bpmn:Message#property (plain)', async function() {

      // given
      const event = await expectSelected('MessageEvent'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-messageEventTemplate-0', container),
            input = findInput('text', entry);

      changeInput(input, 'meaningfulMessageName');

      // then
      const message = findMessage(businessObject);

      expect(message).to.exist;
      expect(message).to.have.property('name', 'meaningfulMessageName');
    });


    it('should change, creating bpmn:Message if non-existing', async function() {

      // given
      const event = await expectSelected('MessageEvent_noData'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-messageEventTemplate-0', container),
            input = findInput('text', entry);

      changeInput(input, 'meaningfulMessageName');

      // then
      const message = findMessage(businessObject);

      // then
      expect(message).to.exist;
      expect(message).to.have.property('name', 'meaningfulMessageName');
    });


    it('should NOT remove bpmn:Message when changed to empty value', inject(async function() {

      // given
      const event = await expectSelected('MessageEvent'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-messageEventTemplate-0', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const message = findMessage(businessObject);

      expect(message).to.exist;
      expect(message).to.have.property('name', '');
    }));

  });


  describe('bpmn:Message#zeebe:subscription#property', function() {


    it('should display', async function() {

      // when
      await expectSelected('MessageEvent');

      // then
      const entry = findEntry('custom-entry-messageEventTemplate-1', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('correlationKey');
    });


    it('should NOT display (type=hidden)', async function() {

      // when
      await expectSelected('MessageEvent_hidden');

      // then
      const entry = findEntry('custom-entry-messageEventTemplate_hidden-1', container);

      expect(entry).to.not.exist;
    });


    it('should change, setting zeebe:subscription#property (plain)', async function() {

      // given
      const event = await expectSelected('MessageEvent'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-messageEventTemplate-1', container),
            input = findInput('text', entry);

      changeInput(input, 'meaningfulCorrelationKey');

      // then
      const message = findMessage(businessObject);
      const subscription = findZeebeSubscription(message);

      expect(subscription).to.exist;
      expect(subscription).to.have.property('correlationKey', 'meaningfulCorrelationKey');
    });


    it('should change, creating bpmn:Message if non-existing', async function() {

      // given
      const event = await expectSelected('MessageEvent_noData'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-messageEventTemplate-1', container),
            input = findInput('text', entry);

      changeInput(input, 'meaningfulCorrelationKey');

      // then
      const message = findMessage(businessObject);
      const subscription = findZeebeSubscription(message);

      // then
      expect(subscription).to.exist;
      expect(subscription).to.have.property('correlationKey', 'meaningfulCorrelationKey');
    });


    it('should NOT remove zeebe:subscription when changed to empty value', inject(async function() {

      // given
      const event = await expectSelected('MessageEvent'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-messageEventTemplate-1', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const message = findMessage(businessObject);
      const subscription = findZeebeSubscription(message);

      expect(subscription).to.exist;
      expect(subscription).to.have.property('correlationKey', '');
    }));

  });


  describe('zeebe:calledElement', function() {


    it('should display', async function() {

      // when
      await expectSelected('CalledElement');

      // then
      const entry = findEntry('custom-entry-calledElement-0', container),
            input = findInput('text', entry);

      expect(entry).to.exist;
      expect(input).to.exist;
      expect(input.value).to.equal('paymentProcess');
    });


    it('should change, setting zeebe:calledElement', async function() {

      // given
      const element = await expectSelected('CalledElement'),
            businessObject = getBusinessObject(element);

      // when
      const entry = findEntry('custom-entry-calledElement-0', container),
            input = findInput('text', entry);

      changeInput(input, 'anotherProcessId');

      // then
      const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

      expect(calledElement).to.exist;
      expect(calledElement).to.have.property('processId', 'anotherProcessId');
    });


    it('should change, creating zeebe:calledElement if non-existing', async function() {

      // given
      const element = await expectSelected('CalledElement_empty'),
            businessObject = getBusinessObject(element);

      // when
      const entry = findEntry('custom-entry-calledElement-0', container),
            input = findInput('text', entry);

      changeInput(input, 'Called Element');

      // then
      const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

      expect(calledElement).to.exist;
      expect(calledElement).to.have.property('processId', 'paymentProcess');
    });


    it('should NOT remove zeebe:calledElement when changed to empty value', inject(async function() {

      // given
      const event = await expectSelected('CalledElement'),
            businessObject = getBusinessObject(event);

      // when
      const entry = findEntry('custom-entry-calledElement-0', container),
            input = findInput('text', entry);

      changeInput(input, '');

      // then
      const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

      expect(calledElement).to.exist;
      expect(calledElement).to.have.property('processId', '');
    }));
  });


  describe('types', function() {

    describe('Dropdown', function() {

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


      it('should display options', async function() {

        // when
        await expectSelected('DropdownTask');

        // then
        const entry = findEntry('custom-entry-my.example.dropdown-0', container),
              options = domQueryAll('select option', entry);

        expect(Array.from(options).map(({ selected, value }) => {
          return {
            selected,
            value
          };
        })).to.eql([
          { value: 'low', selected: true },
          { value: 'medium', selected: false },
          { value: 'high', selected: false }
        ]);
      });


      it('should display options - optional', async function() {

        // when
        await expectSelected('OptionalDropdownTask');

        // then
        const entry = findEntry('custom-entry-my.example.dropdown-2-0', container),
              options = domQueryAll('select option', entry);

        expect(Array.from(options).map(({ selected, value }) => {
          return {
            selected,
            value
          };
        })).to.eql([
          { value: '', selected: false },
          { value: 'low', selected: true },
          { value: 'medium', selected: false },
          { value: 'high', selected: false }
        ]);
      });


      it('should display options (no visual selection)', async function() {

        // when
        await expectSelected('DropdownNoSelection');

        // then
        const entry = findEntry('custom-entry-my.example.dropdown-1-0', container),
              options = domQueryAll('select option', entry);

        expect(Array.from(options).map(({ selected, value }) => {
          return {
            selected,
            value
          };
        })).to.eql([
          { value: 'low', selected: false },
          { value: 'medium', selected: false },
          { value: 'high', selected: false }
        ]);
      });


      it('should change, updating binding', async function() {

        // given
        const task = await expectSelected('DropdownTask'),
              businessObject = getBusinessObject(task);

        const entry = findEntry('custom-entry-my.example.dropdown-0', container),
              select = findSelect(entry);

        // when
        changeInput(select, 'medium');

        // then
        expect(businessObject.get('name')).to.equal('medium');
      });

    });


    describe('Text', function() {

      beforeEach(bootstrapPropertiesPanel(textLanguageDiagramXML, {
        container,
        debounceInput: false,
        elementTemplates: textLanguageElementTemplates,
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


      it('should display <language> annotated with monospace font', async function() {

        // when
        await expectSelected('textTask');

        // then
        const entry = findEntry('custom-entry-my.example.custom-language-text-0', container);
        const input = findTextarea(entry);

        expect(input.className).to.include('bio-properties-panel-input-monospace');
      });


      withPropertiesPanel('>=1.3.0')('should be auto-resizable', async function() {

        // when
        await expectSelected('textTask');

        // then
        const entry = findEntry('custom-entry-my.example.custom-language-text-0', container);
        const input = findTextarea(entry);

        expect(input.className).to.include('auto-resize');
      });

    });

  });


  describe('description', function() {

    beforeEach(bootstrapPropertiesPanel(descriptionDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: descriptionElementTemplates,
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


    it('should display description for string property', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.description-0', container);

      expect(entry.textContent).to.contain('STRING_DESCRIPTION');
    });


    it('should display description for textarea property', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.description-1', container);

      expect(entry.textContent).to.contain('TEXT_DESCRIPTION');
    });


    it('should display description for boolean property', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.description-2', container);

      expect(entry.textContent).to.contain('BOOLEAN_DESCRIPTION');
    });


    it('should display description for dropdown property', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.description-3', container);

      expect(entry.textContent).to.contain('DROPDOWN_DESCRIPTION');
    });


    it('should display HTML descriptions', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.description-4', container);
      const description = domQuery('.bio-properties-panel-description', entry);

      expect(description).to.exist;
      expect(description.innerHTML).to.eql(
        '<div class="markup">' +
          '<div xmlns="http://www.w3.org/1999/xhtml">' +
            'By the way, you can use ' +
            '<a href="https://freemarker.apache.org/" target="_blank" rel="noopener">freemarker templates</a> ' +
            'here' +
          '</div>' +
        '</div>'
      );
    });


    it('should NOT display empty descriptions', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.description-5', container);
      const description = domQuery('.bio-properties-panel-description', entry);

      expect(description).to.not.exist;
    });
  });


  describe('tooltip', function() {

    let clock;

    function openTooltip(element) {
      return act(() => {
        fireEvent.mouseEnter(element);
        clock.tick(200);
      });
    }

    beforeEach(function() {
      clock = sinon.useFakeTimers();
    });

    afterEach(function() {
      cleanup();
      clock.restore();
    });

    beforeEach(bootstrapPropertiesPanel(tooltipDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: tooltipElementTemplates,
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


    it('should display tooltip for string property', async function() {

      // given
      await expectSelected('Task');

      const entry = findEntry('custom-entry-com.zeebe.example.tooltip-group-0', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', entry);

      // when
      await openTooltip(tooltipWrapper);
      const tooltip = domQuery('.bio-properties-panel-tooltip', entry);

      // then
      expect(tooltip).to.exist;
      expect(tooltip.textContent).to.contain('STRING_TOOLTIP');
    });


    it('should display tooltip for textarea property', async function() {

      // when
      await expectSelected('Task');

      const entry = findEntry('custom-entry-com.zeebe.example.tooltip-group-1', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', entry);

      // then
      await openTooltip(tooltipWrapper);
      const tooltip = domQuery('.bio-properties-panel-tooltip', entry);

      // then
      expect(tooltip).to.exist;
      expect(tooltip.textContent).to.contain('TEXT_TOOLTIP');
    });


    it('should display tooltip for boolean property', async function() {

      // given
      await expectSelected('Task');

      const entry = findEntry('custom-entry-com.zeebe.example.tooltip-group-2', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', entry);

      // when
      await openTooltip(tooltipWrapper);
      const tooltip = domQuery('.bio-properties-panel-tooltip', entry);

      // then
      expect(tooltip).to.exist;
      expect(tooltip.textContent).to.contain('BOOLEAN_TOOLTIP');
    });


    it('should display tooltip for dropdown property', async function() {

      // given
      await expectSelected('Task');

      const entry = findEntry('custom-entry-com.zeebe.example.tooltip-group-3', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', entry);

      // when
      await openTooltip(tooltipWrapper);
      const tooltip = domQuery('.bio-properties-panel-tooltip', entry);

      // then
      expect(tooltip).to.exist;
      expect(tooltip.textContent).to.contain('DROPDOWN_TOOLTIP');
    });


    it('should display tooltip for groups', async function() {

      // given
      await expectSelected('Task');

      const group = domQuery('.bio-properties-panel-group-header-title[title="Custom group"]', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', group);

      // when
      await openTooltip(tooltipWrapper);
      const tooltip = domQuery('.bio-properties-panel-tooltip');

      // then
      expect(tooltip).to.exist;
      expect(tooltip.textContent).to.contain('GROUP_TOOLTIP');
    });


    it('should display HTML tooltips', async function() {

      // given
      await expectSelected('Task');

      const entry = findEntry('custom-entry-com.zeebe.example.tooltip-group-4', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', entry);

      // when
      await openTooltip(tooltipWrapper);
      const tooltip = domQuery('.bio-properties-panel-tooltip-content', entry);

      // then
      expect(tooltip).to.exist;
      expect(tooltip.innerHTML).to.eql(
        '<div class="markup">' +
          '<div xmlns="http://www.w3.org/1999/xhtml">' +
            'By the way, you can use ' +
            '<a href="https://freemarker.apache.org/" target="_blank" rel="noopener">freemarker templates</a> ' +
            'here' +
          '</div>' +
        '</div>'
      );
    });


    it('should NOT display empty descriptions', async function() {

      // given
      await expectSelected('Task');

      const entry = findEntry('custom-entry-com.zeebe.example.tooltip-group-5', container);
      const tooltipWrapper = domQuery('.bio-properties-panel-tooltip-wrapper', entry);

      // then
      expect(tooltipWrapper).to.not.exist;
    });
  });


  describe('editable', function() {

    beforeEach(bootstrapPropertiesPanel(editableDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: editableElementTemplates,
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


    it('should NOT disable input when editable is NOT set', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.editable-4', container),
            input = findInput('text', entry);

      expect(input).not.to.have.property('disabled', true);
    });


    it('should NOT disable input when editable=true', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.editable-5', container),
            input = findInput('text', entry);

      expect(input).not.to.have.property('disabled', true);
    });


    it('should disable string input when editable=false', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.editable-0', container),
            input = findInput('text', entry);

      expect(input).to.have.property('disabled', true);
    });


    it('should disable textarea input when editable=false', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.editable-1', container),
            input = findTextarea(entry);

      expect(input).to.have.property('disabled', true);
    });


    it('should disable boolean input when editable=false', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.editable-2', container),
            input = findInput('checkbox', entry);

      expect(input).to.have.property('disabled', true);
    });


    it('should disable dropdown input when editable=false', async function() {

      // when
      await expectSelected('Task');

      // then
      const entry = findEntry('custom-entry-com.zeebe.example.editable-3', container),
            input = findSelect(entry);

      expect(input).to.have.property('disabled', true);
    });
  });


  describe('validation', function() {

    [
      [ 'String', 'input' ],
      [ 'Select', 'select' ],
      [ 'TextArea', 'textarea' ]
    ].forEach(function([ name, selector ]) {

      describe(name, function() {

        it('should validate nonEmpty', async function() {

          // given
          await expectSelected('ValidateTask');

          const entry = findEntry(`custom-entry-com.validated-inputs.Task-${selector}-0`, container),
                input = domQuery(selector, entry);

          // assume
          expectError(entry, `${name} - NotEmpty must not be empty.`);

          // when
          changeInput(input, 'FOO');

          // then
          expectValid(entry);
        });


        it('should validate minLength', async function() {

          // given
          await expectSelected('ValidateTask');

          const entry = findEntry(`custom-entry-com.validated-inputs.Task-${selector}-1`, container),
                input = domQuery(selector, entry);

          // assume
          expectError(entry, `${name} - Field must be at least 5 characters.`);

          // when
          changeInput(input, 'FOOOOOOO');

          // then
          expectValid(entry);
        });


        it('should validate maxLength', async function() {

          // given
          await expectSelected('ValidateTask');

          const entry = findEntry(`custom-entry-com.validated-inputs.Task-${selector}-2`, container),
                input = domQuery(selector, entry);

          // assume
          expectValid(entry);

          // when
          changeInput(input, 'FOOOOOOO');

          // then
          expectError(entry, `${name} - MaxLength Field cannot exceed 5 characters.`);
        });


        it('should validate pattern (String)', async function() {

          // given
          await expectSelected('ValidateTask');

          const entry = findEntry(`custom-entry-com.validated-inputs.Task-${selector}-3`, container),
                input = domQuery(selector, entry);

          // assume
          expectError(entry, `${name} - Pattern (String) must match pattern A+B.`);

          // when
          changeInput(input, 'AAAB');

          // then
          expectValid(entry);
        });


        it('should validate pattern (String + Message)', async function() {

          // given
          await expectSelected('ValidateTask');

          const entry = findEntry(`custom-entry-com.validated-inputs.Task-${selector}-4`, container),
                input = domQuery(selector, entry);

          // assume
          expectError(entry, `${name} - Pattern (String + Message) Must start with https://`);

          // when
          changeInput(input, 'https://');

          // then
          expectValid(entry);
        });


        it('should validate pattern (Integer)', async function() {

          // given
          await expectSelected('ValidateTask');

          const entry = findEntry(`custom-entry-com.validated-inputs.Task-${selector}-5`, container),
                input = domQuery(selector, entry);

          // assume
          expectError(entry, `${name} - Pattern (Integer) Must be positive integer`);

          // when
          changeInput(input, '20');

          // then
          expectValid(entry);
        });

      });

    });


    it('should work with conditional properties', inject(
      async function(elementTemplates, elementRegistry) {

        // given
        await expectSelected('ValidatedConditionalTask');
        const task = elementRegistry.get('ValidatedConditionalTask');
        const template = templates.find(t => t.id === 'com.validated-inputs-conditional.Task');

        // when
        await act(() => {
          elementTemplates.applyTemplate(task, template);
        });

        // then
        const entry = findEntry('custom-entry-com.validated-inputs-conditional.Task-authentication-1', container),
              input = domQuery('input', entry);
        expectError(entry, 'Bearer token must not be empty.');

        // and when
        changeInput(input, '123456');

        // then
        expectValid(entry);
      })
    );
  });


  describe('default-types', function() {

    beforeEach(bootstrapPropertiesPanel(defaultTypesDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: defaultTypesElementTemplates,
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


    it('should display String as default - property', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-0', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
    });


    it('should display String as default - zeebe:taskDefinition:type', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-1', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
    });


    it('should display String as default - zeebe:taskHeader', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-2', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
    });


    it('should display String as default - zeebe:input', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-3', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
    });


    it('should display String as default - zeebe:output', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-4', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
    });


    it('should display String as default - zeebe:property', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-5', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
    });

  });


  describe('default values', function() {

    beforeEach(bootstrapPropertiesPanel(defaultValuesDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: defaultValuesElementTemplates,
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


    it('should display empty String - property', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-0', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
      expect(input.value).to.eql('');
    });


    it('should display String as default - zeebe:taskDefinition:type', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-1', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
      expect(input.value).to.eql('');
    });


    it('should display String as default - zeebe:taskHeader', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-2', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
      expect(input.value).to.eql('');
    });


    it('should display String as default - zeebe:input', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-3', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
      expect(input.value).to.eql('');
    });


    it('should display String as default - zeebe:output', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-4', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
      expect(input.value).to.eql('');
    });


    it('should display String as default - zeebe:property', async function() {

      // given
      await expectSelected('RestTask');

      const entry = findEntry('custom-entry-com.example.default-types-5', container),
            input = findInput('text', entry);

      // then
      expect(input).to.exist;
      expect(input.value).to.eql('');
    });

  });


  describe('grouping', function() {

    beforeEach(bootstrapPropertiesPanel(groupsDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: groupsElementTemplates,
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


    it('should create defined groups', async function() {

      // given
      await expectSelected('ServiceTask_1');

      // when
      const groups = getGroupIds(container);

      // then
      expect(groups).to.contain('ElementTemplates__CustomProperties-headers');
      expect(groups).to.contain('ElementTemplates__CustomProperties-payload');
      expect(groups).to.contain('ElementTemplates__CustomProperties-mapping');
      expect(groups).to.contain('ElementTemplates__CustomProperties');
    });


    it('should open custom groups by default', async function() {

      // given
      await expectSelected('ServiceTask_groupsCollapsed');

      // when
      var customGroups = [
        [ getGroupById('ElementTemplates__CustomProperties-collapsed', container), false ],
        [ getGroupById('ElementTemplates__CustomProperties-open', container), true ],
        [ getGroupById('ElementTemplates__CustomProperties-unspecified', container), true ],
        [ getGroupById('ElementTemplates__CustomProperties', container),true ]
      ];

      // then
      customGroups.forEach(function([ group, open ]) {
        expectGroupOpen(group, open);
      });

    });


    it('should display in defined properties order', async function() {

      // given
      await expectSelected('ServiceTask_1');

      // when
      const groups = getGroupIds(container);

      // then
      expect(groups).to.eql([
        'ElementTemplates__Template',
        'ElementTemplates__CustomProperties-headers',
        'ElementTemplates__CustomProperties-payload',
        'ElementTemplates__CustomProperties-mapping',
        'ElementTemplates__CustomProperties',
      ]);
    });


    it('should not create defined group (no entries)', async function() {

      // given
      await expectSelected('ServiceTask_noEntries');

      // when
      const groups = getGroupIds(container);

      // then
      expect(groups).to.not.contain('ElementTemplates__CustomProperties-headers');
    });


    it('should only create default group', async function() {

      // given
      await expectSelected('ServiceTask_noGroups');

      // when
      const groups = getGroupIds(container);

      // then
      expect(groups).to.eql([
        'ElementTemplates__Template',
        'ElementTemplates__CustomProperties'
      ]);
    });


    it('should open default group', async function() {

      // given
      await expectSelected('ServiceTask_noGroups');

      // when
      var tempalteGroup = getGroupById('ElementTemplates__Template', container);
      var customPropertiesGroup = getGroupById('ElementTemplates__CustomProperties', container);


      // then
      expectGroupOpen(tempalteGroup, false);
      expectGroupOpen(customPropertiesGroup, true);
    });


    it('should not create default group', async function() {

      // given
      await expectSelected('ServiceTask_noDefault');

      // when
      const groups = getGroupIds(container);

      // then
      expect(groups).to.not.contain('ElementTemplates__CustomProperties');
    });


    it('should position into defined groups', async function() {

      // given
      await expectSelected('ServiceTask_1');

      // when
      const entry1 = findEntry('custom-entry-example.com.grouping-headers-0', container);
      const entry2 = findEntry('custom-entry-example.com.grouping-payload-0', container);
      const entry3 = findEntry('custom-entry-example.com.grouping-mapping-0', container);

      // then
      expect(getGroup(entry1)).to.equal('ElementTemplates__CustomProperties-headers');
      expect(getGroup(entry2)).to.equal('ElementTemplates__CustomProperties-payload');
      expect(getGroup(entry3)).to.equal('ElementTemplates__CustomProperties-mapping');
    });


    it('should position into default group (empty group id)', async function() {

      // given
      await expectSelected('ServiceTask_1');

      // when
      const entry = findEntry('custom-entry-example.com.grouping-0', container);

      // then
      expect(getGroup(entry)).to.equal('ElementTemplates__CustomProperties');
    });


    it('should position into default group (non existing group)', async function() {

      // given
      await expectSelected('ServiceTask_nonExisting');

      // when
      const entry = findEntry('custom-entry-example.com.grouping-nonExisting-0', container);

      // then
      expect(getGroup(entry)).to.equal('ElementTemplates__CustomProperties');
    });

  });


  describe('feel', function() {

    beforeEach(bootstrapPropertiesPanel(feelDiagramXML, {
      container,
      debounceInput: false,
      elementTemplates: feelElementTemplates,
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


    describe('TextField', function() {

      it('should not display icon by default', async function() {

        // when
        await expectSelected('stringTask');

        // then
        const entry = findEntry('custom-entry-my.custom.FeelTask.String-2', container);

        const feelIcon = domQuery('.bio-properties-panel-feel-icon', entry);

        expect(feelIcon).not.to.exist;

      });


      it('should display icons', async function() {

        // when
        await expectSelected('stringTask');

        // then
        const requiredEntry = findEntry('custom-entry-my.custom.FeelTask.String-0', container);
        const optionalEntry = findEntry('custom-entry-my.custom.FeelTask.String-1', container);

        const requiredIcon = domQuery('.bio-properties-panel-feel-icon', requiredEntry);
        const optionalIcon = domQuery('.bio-properties-panel-feel-icon', optionalEntry);

        expect(requiredIcon).to.exist;
        expect(optionalIcon).to.exist;
      });

    });


    describe('TextArea', function() {

      it('should not display icon by default', async function() {

        // when
        await expectSelected('textTask');

        // then
        const entry = findEntry('custom-entry-my.custom.FeelTask.Text-2', container);

        const feelIcon = domQuery('.bio-properties-panel-feel-icon', entry);

        expect(feelIcon).not.to.exist;

      });


      it('should display icons on TextArea', async function() {

        // when
        await expectSelected('textTask');

        // then
        const requiredEntry = findEntry('custom-entry-my.custom.FeelTask.Text-0', container);
        const optionalEntry = findEntry('custom-entry-my.custom.FeelTask.Text-1', container);

        const requiredIcon = domQuery('.bio-properties-panel-feel-icon', requiredEntry);
        const optionalIcon = domQuery('.bio-properties-panel-feel-icon', optionalEntry);

        expect(requiredIcon).to.exist;
        expect(optionalIcon).to.exist;
      });

    });

  });

});


// helpers //////////

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

function expectGroupOpen(group, open) {
  expect(group).to.not.be.null;

  const entries = domQuery('.bio-properties-panel-group-entries', group);

  expect(domClasses(entries).contains('open')).to.eql(open);
}

function expectValid(entry) {
  expectError(entry, null);
}

function getGroupIds(container) {
  expect(container).to.not.be.null;

  const groups = domQueryAll('[data-group-id]', container);

  const groupIds = map(groups, group => withoutPrefix(group.dataset.groupId));

  return groupIds;
}

function getGroup(entry) {
  const parent = entry.closest('[data-group-id]');

  return parent && withoutPrefix(parent.dataset.groupId);
}

function getGroupById(id, container) {
  expect(container).to.not.be.null;

  const group = domQuery(
    `[data-group-id=group-${id}]`,
    container
  );

  return group;
}

function withoutPrefix(groupId) {
  return groupId.slice(6);
}

function findEntry(id, container) {
  expect(container).to.not.be.null;

  return domQuery(`[data-entry-id='${ id }']`, container);
}

function findInput(type, container) {
  expect(container).to.not.be.null;

  return domQuery(`input[type='${ type }']`, container);
}

function findSelect(container) {
  expect(container).to.not.be.null;

  return domQuery('select', container);
}

function findTextarea(container) {
  expect(container).to.not.be.null;

  return domQuery('textarea', container);
}