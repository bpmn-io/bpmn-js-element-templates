import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';

import {
  bootstrapModeler,
  inject
} from 'test/TestHelper';

import { find } from 'min-dash';

import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesModule from 'src/cloud-element-templates';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import {
  findConditionalEventDefinition,
  findExtension,
  findInputParameter,
  findMessage,
  findOutputParameter,
  findSignal,
  findTaskHeader,
  findTimerEventDefinition,
  findZeebeProperty,
  findZeebeSubscription
} from 'src/cloud-element-templates/Helper';

import diagramXML from '../fixtures/simple.bpmn';

import templates from './TemplatesElementFactory.json';

import conditionTemplates from './TemplateElementFactory.conditions.json';

import completionConditionTemplates from '../fixtures/completion-condition.json';

import subprocessTemplates from '../fixtures/subprocess.json';


describe('provider/cloud-element-templates - TemplateElementFactory', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapModeler(diagramXML, {
    container: container,
    modules: [
      coreModule,
      elementTemplatesModule,
      modelingModule,
      {
        propertiesPanel: [ 'value', { registerProvider() {} } ]
      }
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    }
  }));


  it('should create element', inject(function(templateElementFactory) {

    // given
    const elementTemplate = findTemplate('example.camunda.ServiceWorker');

    // when
    const element = templateElementFactory.create(elementTemplate);

    const extensionElements = getBusinessObject(element).get('extensionElements');

    // then
    expect(element).to.exist;
    expect(extensionElements).to.exist;
    expect(extensionElements.get('values')).to.have.length(3);
  }));


  it('should set type (appliesTo)', inject(function(templateElementFactory) {

    // given
    const elementTemplate = findTemplate('example.camunda.MultipleTypes');

    // when
    const element = templateElementFactory.create(elementTemplate);

    // then
    expect(element.type).to.equal('bpmn:ServiceTask');
  }));


  it('should set type (elementType)', inject(function(templateElementFactory) {

    // given
    const elementTemplate = findTemplate('example.camunda.ElementType');

    // when
    const element = templateElementFactory.create(elementTemplate);

    // then
    expect(element.type).to.equal('bpmn:ServiceTask');
  }));


  it('should apply <modelerTemplate> and <modelerTemplateVersion>', inject(function(templateElementFactory) {

    // given
    const elementTemplate = findTemplate('example.camunda.ServiceWorker');

    // when
    const element = templateElementFactory.create(elementTemplate);

    const businessObject = getBusinessObject(element);

    // then
    expect(businessObject.get('zeebe:modelerTemplate')).to.equal('example.camunda.ServiceWorker');
    expect(businessObject.get('zeebe:modelerTemplateVersion')).to.equal(1);
  }));


  it('should apply <modelerTemplateIcon>', inject(function(templateElementFactory) {

    // given
    const elementTemplate = findTemplate('example.camunda.IconTemplate');

    // when
    const element = templateElementFactory.create(elementTemplate);

    const icon = getBusinessObject(element).get('zeebe:modelerTemplateIcon');

    // then
    expect(icon).to.exist;
    expect(icon).to.equal("data:image/svg+xml,%3Csvg width='24' height='24'%3C/svg%3E");
  }));


  it('should create expanded subprocess elements', inject(function(templateElementFactory) {

    // given
    const subprocessTemplate = subprocessTemplates[0]; // 'subprocess' template

    // when
    const element = templateElementFactory.create(subprocessTemplate);

    // then
    expect(element.type).to.equal('bpmn:SubProcess');
    expect(element.collapsed).to.be.false; // subprocess should be expanded
  }));


  it('should create expanded AdHoc subprocess elements', inject(function(templateElementFactory) {

    // given
    const adHocSubprocessTemplate = {
      '$schema': 'https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json',
      'id': 'adhocsubprocess',
      'name': 'AdHocSubProcess',
      'version': 1,
      'appliesTo': [ 'bpmn:AdHocSubProcess' ],
      'properties': []
    };

    // when
    const element = templateElementFactory.create(adHocSubprocessTemplate);

    // then
    expect(element.type).to.equal('bpmn:AdHocSubProcess');
    expect(element.collapsed).to.be.false; // AdHoc subprocess should also be expanded
  }));


  it('should apply <modelerTemplate> on templated message (bpmn:Message#property)',
    inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.MessageTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const businessObject = getBusinessObject(element);
      const message = findMessage(businessObject);

      // then
      expect(message.get('zeebe:modelerTemplate')).to.equal('example.camunda.MessageTemplate');
    })
  );


  it('should apply <modelerTemplate> on templated message (bpmn:Message#zeebe:subscription#property',
    inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.SubscriptionMessageTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const businessObject = getBusinessObject(element);
      const message = findMessage(businessObject);

      // then
      expect(message.get('zeebe:modelerTemplate')).to.equal('example.camunda.SubscriptionMessageTemplate');
    })
  );


  it('should apply <modelerTemplate> on templated signal (bpmn:Signal#property)',
    inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.SignalTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const businessObject = getBusinessObject(element);
      const signal = findSignal(businessObject);

      // then
      expect(signal.get('zeebe:modelerTemplate')).to.equal('example.camunda.SignalTemplate');
    })
  );


  describe('providers', function() {


    it('should NOT create extension elements - not needed', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.PropertyBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const businessObject = getBusinessObject(element);

      // then
      expect(businessObject.get('extensionElements')).to.not.exist;
    }));


    it('should handle <property>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.PropertyBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const businessObject = getBusinessObject(element);

      // then
      expect(businessObject.get('name')).to.equal('name');
    }));


    it('should handle <zeebe:property>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.ZeebePropertyBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const zeebeProperties = findExtension(element, 'zeebe:Properties');
      const properties = zeebeProperties.properties;

      // then
      expect(properties).to.exist;
      expect(properties).to.jsonEqual([
        {
          $type: 'zeebe:Property',
          name: 'customPropertyName',
          value: 'propertyValue'
        }
      ]);
    }));


    it('should handle <zeebe:taskDefinition:type>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TaskDefinitionTypeBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const taskDefinition = findExtension(element, 'zeebe:TaskDefinition');

      // then
      expect(taskDefinition).to.exist;
      expect(taskDefinition.get('type')).to.equal('job-type');
    }));


    it('should handle <zeebe:taskDefinition>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TaskDefinitionBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const taskDefinition = findExtension(element, 'zeebe:TaskDefinition');

      // then
      expect(taskDefinition).to.exist;
      expect(taskDefinition.get('type')).to.equal('job-type');
    }));


    it('should handle <zeebe:input>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.InputBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const ioMapping = findExtension(element, 'zeebe:IoMapping');
      const inputParameters = ioMapping.get('inputParameters');

      // then
      expect(inputParameters).to.exist;
      expect(inputParameters).to.jsonEqual([
        {
          $type: 'zeebe:Input',
          source: 'input-1-value',
          target: 'input-1'
        },
        {
          $type: 'zeebe:Input',
          source: 'input-2-value',
          target: 'input-2'
        },
        {
          $type: 'zeebe:Input',
          source: 'input-3-value',
          target: 'input-3'
        }
      ]);
    }));


    it('should handle <zeebe:output>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.OutputBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const ioMapping = findExtension(element, 'zeebe:IoMapping');
      const outputParameters = ioMapping.get('outputParameters');

      // then
      expect(outputParameters).to.exist;
      expect(outputParameters).to.jsonEqual([
        {
          $type: 'zeebe:Output',
          source: 'output-1',
          target: 'output-1-value'
        },
        {
          $type: 'zeebe:Output',
          source: 'output-2',
          target: 'output-2-value'
        },
        {
          $type: 'zeebe:Output',
          source: 'output-3',
          target: 'output-3-value'
        }
      ]);
    }));


    it('should NOT create optional inputs and outputs', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.OptionalInputOutput');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const ioMapping = findExtension(element, 'zeebe:IoMapping');
      const inputParameters = ioMapping.get('inputParameters');
      const outputParameters = ioMapping.get('outputParameters');

      // then
      expect(inputParameters).to.exist;
      expect(inputParameters).to.jsonEqual([
        {
          $type: 'zeebe:Input',
          source: 'input-2-value',
          target: 'input-2'
        }
      ]);

      expect(outputParameters).to.exist;
      expect(outputParameters).to.jsonEqual([
        {
          $type: 'zeebe:Output',
          source: 'output-1',
          target: 'output-1-value'
        }
      ]);
    }));



    it('should handle <zeebe:taskHeader>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TaskHeaderBinding');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const taskHeaders = findExtension(element, 'zeebe:TaskHeaders');
      const headers = taskHeaders.get('values');

      // then
      expect(headers).to.exist;
      expect(headers).to.jsonEqual([
        {
          $type: 'zeebe:Header',
          key: 'header-1',
          value: 'header-1-value'
        },
        {
          $type: 'zeebe:Header',
          key: 'header-2',
          value: 'header-2-value'
        },
        {
          $type: 'zeebe:Header',
          key: 'header-3',
          value: 'header-3-value'
        }
      ]);
    }));


    it('should handle <bpmn:Message#property>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.MessageTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const eventDefinition = bo.get('eventDefinitions')[0];
      const message = eventDefinition.get('messageRef');

      // then
      expect(message).to.exist;
      expect(message).to.have.property('name', 'hard-coded');
    }));


    it('should handle <bpmn:Message#property> (Receive Task)', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('messageEventTemplateReceiveTask');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);
      const message = bo.get('messageRef');

      // then
      expect(message).to.exist;
      expect(message).to.have.property('name', 'hard-coded');
    }));


    it('should handle <bpmn:Message#zeebe:subscription>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.SubscriptionMessageTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const eventDefinition = bo.get('eventDefinitions')[0];
      const message = eventDefinition.get('messageRef');
      const subscription = findExtension(message, 'zeebe:Subscription');

      // then
      expect(subscription).to.exist;
      expect(subscription).to.jsonEqual({
        $type: 'zeebe:Subscription',
        correlationKey: '=variable'
      });
    }));


    it('should handle <bpmn:Message#zeebe:subscription> (Receive Task)', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('messageEventSubscriptionTemplateReceiveTask');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);
      const message = bo.get('messageRef');
      const subscription = findExtension(message, 'zeebe:Subscription');

      // then
      expect(subscription).to.exist;
      expect(subscription).to.jsonEqual({
        $type: 'zeebe:Subscription',
        correlationKey: '=variable'
      });
    }));


    it('should handle <bpmn:Signal#property>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.SignalTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const eventDefinition = bo.get('eventDefinitions')[0];
      const signal = eventDefinition.get('signalRef');

      // then
      expect(signal).to.exist;
      expect(signal).to.have.property('name', 'hard-coded-signal');
    }));


    it('should handle <bpmn:TimerEventDefinition#property> - timeCycle', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TimerStartEventTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const timerEventDefinition = findTimerEventDefinition(bo);

      // then
      expect(timerEventDefinition).to.exist;
      expect(is(timerEventDefinition, 'bpmn:TimerEventDefinition')).to.be.true;

      const timeCycle = timerEventDefinition.get('timeCycle');
      expect(timeCycle).to.exist;
      expect(timeCycle.get('body')).to.equal('0 0 9-17 * * MON-FRI');
    }));


    it('should handle <bpmn:TimerEventDefinition#property> - timeDuration', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TimerCatchEventTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const timerEventDefinition = findTimerEventDefinition(bo);

      // then
      expect(timerEventDefinition).to.exist;
      expect(is(timerEventDefinition, 'bpmn:TimerEventDefinition')).to.be.true;

      const timeDuration = timerEventDefinition.get('timeDuration');
      expect(timeDuration).to.exist;
      expect(timeDuration.get('body')).to.equal('PT1H');
    }));


    it('should handle <bpmn:TimerEventDefinition#property> - timeDate with FEEL expression', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TimerDateEventTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const timerEventDefinition = findTimerEventDefinition(bo);

      // then
      expect(timerEventDefinition).to.exist;
      expect(is(timerEventDefinition, 'bpmn:TimerEventDefinition')).to.be.true;

      const timeDate = timerEventDefinition.get('timeDate');
      expect(timeDate).to.exist;
      expect(timeDate.get('body')).to.equal('=now() + duration("PT1H")');
    }));

    it('should handle <bpmn:TimerEventDefinition#property> - timeCycle on boundary event making it non-interrupting', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.TimerBoundaryEventTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);
      const bo = getBusinessObject(element);

      const timerEventDefinition = findTimerEventDefinition(bo);

      // then
      expect(element.type).to.equal('bpmn:BoundaryEvent');
      expect(bo.get('cancelActivity')).to.be.false;

      expect(timerEventDefinition).to.exist;
      expect(is(timerEventDefinition, 'bpmn:TimerEventDefinition')).to.be.true;

      const timeCycle = timerEventDefinition.get('timeCycle');
      expect(timeCycle).to.exist;
      expect(timeCycle.get('body')).to.equal('R/PT5M');
    }));


    it('should handle <bpmn:ConditionalEventDefinition#property> - condition expression', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.ConditionalStartEventTemplate');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const conditionalEventDefinition = findConditionalEventDefinition(bo);
      expect(conditionalEventDefinition).to.exist;

      const condition = conditionalEventDefinition.get('condition');
      expect(condition.get('body')).to.equal('=myVariable > 100');
    }));


    it('should handle <bpmn:ConditionalEventDefinition#zeebe:conditionalFilter#property> - variableEvents', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('example.camunda.ConditionalEventWithConditionalFilter');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const conditionalEventDefinition = findConditionalEventDefinition(bo);
      expect(conditionalEventDefinition).to.exist;

      const extensionElements = conditionalEventDefinition.get('extensionElements');
      const conditionalFilter = findExtension(extensionElements, 'zeebe:ConditionalFilter');

      expect(conditionalFilter.get('variableEvents')).to.equal('create,update');
    }));


    it('should handle <zeebe:calledElement>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('calledElement');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const calledElement = findExtension(bo, 'zeebe:CalledElement');

      expect(calledElement).to.exist;
      expect(calledElement).to.jsonEqual({
        $type: 'zeebe:CalledElement',
        propagateAllChildVariables: false,
        propagateAllParentVariables: false,
        processId: 'paymentProcess'
      });
    }));


    it('should handle <zeebe:linkedElement>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('linkedResource');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const linkedResources = findExtension(element, 'zeebe:LinkedResources');
      const resources = linkedResources.get('values');

      // then
      expect(resources).to.exist;
      expect(resources).to.jsonEqual([
        {
          $type: 'zeebe:LinkedResource',
          linkName: 'Link1',
          resourceType: 'foo'
        },
        {
          $type: 'zeebe:LinkedResource',
          linkName: 'Link2',
          resourceId: 'bar'
        },
      ]);
    }));


    it('should handle <zeebe:userTask>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('zeebeUserTask');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const userTask = findExtension(element, 'zeebe:UserTask');

      // then
      expect(userTask).to.exist;
    }));

    it('should handle <zeebe:calledDecision>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('calledDecision');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const calledDecision = findExtension(bo, 'zeebe:CalledDecision');

      expect(calledDecision).to.exist;
      expect(calledDecision).to.jsonEqual({
        $type: 'zeebe:CalledDecision',
        decisionId: 'aDecisionId',
        resultVariable: 'aResultVariableName',
      });
    }));


    it('should handle <zeebe:script>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('script-task-1');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const script = findExtension(bo, 'zeebe:Script');

      expect(script).to.exist;
      expect(script).to.jsonEqual({
        $type: 'zeebe:Script',
        expression: '= "aString" + "aSecondString"',
        resultVariable: 'aResultVariable',
      });
    }));


    it('should handle <zeebe:formDefinition>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('form-definition-template');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const formDefinition = findExtension(bo, 'zeebe:FormDefinition');

      expect(formDefinition).to.exist;
      expect(formDefinition).to.jsonEqual({
        $type: 'zeebe:FormDefinition',
        formId: 'complexFormId',
      });
    }));


    it('should handle <zeebe:assignmentDefinition>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('com.camunda.example.AssignmentDefinition');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const assignmentDefinition = findExtension(bo, 'zeebe:AssignmentDefinition');

      expect(assignmentDefinition).to.exist;
      expect(assignmentDefinition).to.jsonEqual({
        $type: 'zeebe:AssignmentDefinition',
        assignee: 'anAssignee',
        candidateGroups: 'aCandidateGroup, anotherCandidateGroup',
        candidateUsers: 'aCandidateUser'
      });
    }));


    it('should handle <zeebe:priorityDefinition>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('com.camunda.example.PriorityDefinition');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const priorityDefinition = findExtension(bo, 'zeebe:PriorityDefinition');

      expect(priorityDefinition).to.exist;
      expect(priorityDefinition).to.jsonEqual({
        $type: 'zeebe:PriorityDefinition',
        priority: 10
      });
    }));


    it('should handle <zeebe:adHoc>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('ad-hoc-template');

      // when
      const element = templateElementFactory.create(elementTemplate);

      const adHoc = findExtension(element, 'zeebe:AdHoc');

      // then
      expect(adHoc).to.exist;
      expect(adHoc.get('outputCollection')).to.equal('toolCallResults');
      expect(adHoc.get('outputElement')).to.equal('={ id: toolCall._meta.id }');
    }));


    it('should handle <zeebe:taskSchedule>', inject(function(templateElementFactory) {

      // given
      const elementTemplate = findTemplate('com.camunda.example.TaskSchedule');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      const taskSchedule = findExtension(bo, 'zeebe:TaskSchedule');

      expect(taskSchedule).to.exist;
      expect(taskSchedule).to.jsonEqual({
        $type: 'zeebe:TaskSchedule',
        dueDate: '2023-02-01T12:00:00Z',
        followUpDate: '2023-02-05T12:00:00Z'
      });
    }));

  });


  describe('conditional properties', function() {

    it('should apply conditional properties - conditions met', inject(function(templateElementFactory) {

      // given
      const elementTemplate = conditionTemplates[0];

      // when
      const element = templateElementFactory.create(elementTemplate);
      const businessObject = getBusinessObject(element);

      // then
      expectTaskDefinitionType(businessObject, 'nameProp=foo');

      expectInputSource(businessObject, 'nameProp=foo');
      expectOutputTarget(businessObject, 'nameProp=foo');
      expectTaskHeaderValue(businessObject, 'nameProp=foo');
      expectZeebePropertyValue(businessObject, 'nameProp=foo');
    }));


    it('should not apply conditional properties - unmet conditions', inject(function(templateElementFactory) {

      // given
      const elementTemplate = conditionTemplates[0];

      // when
      const element = templateElementFactory.create(elementTemplate);
      const businessObject = getBusinessObject(element);

      // then
      expectTaskDefinitionType(businessObject, 'nameProp=foo');
      expectInputSource(businessObject, 'nameProp=bar', false);
      expectOutputTarget(businessObject, 'nameProp=bar', false);
      expectTaskHeaderValue(businessObject, 'nameProp=bar', false);
      expectZeebePropertyValue(businessObject, 'nameProp=bar', false);
    }));


    it('should apply parent properties first - unordered conditions' , inject(function(templateElementFactory) {

      // given
      const elementTemplate = conditionTemplates[1];

      // // when
      const element = templateElementFactory.create(elementTemplate);
      const businessObject = getBusinessObject(element);

      // then
      expectTaskDefinitionType(businessObject, 'bar');
      expectInputSource(businessObject, 'foo');
      expectOutputTarget(businessObject, 'bar');
      expectTaskHeaderValue(businessObject, 'foo');
      expectZeebePropertyValue(businessObject, 'bar');
    }));

  });


  describe('generated value', function() {


    it('should apply generated values on task (uuid)', inject(function(templateElementFactory) {

      // given
      const uuidRegex = /^[\w\d]{8}(-[\w\d]{4}){3}-[\w\d]{12}$/;
      const elementTemplate = findTemplate('generatedTask');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);
      expect(bo.get('name')).to.match(uuidRegex, 'name is not a uuid');

      const zeebeProperties = findExtension(bo, 'zeebe:Properties');
      const property = findZeebeProperty(zeebeProperties, { name: 'property' });
      expect(property.get('value')).to.match(uuidRegex, 'zeebe property is not a uuid');

      const ioMapping = findExtension(bo, 'zeebe:IoMapping');
      const input = findInputParameter(ioMapping, { name: 'input' });
      expect(input.get('source')).to.match(uuidRegex, 'input parameter is not a uuid');

      const output = findOutputParameter(ioMapping, { source: 'source' });
      expect(output.get('target')).to.match(uuidRegex, 'output parameter is not a uuid');

      const taskHeaders = findExtension(bo, 'zeebe:TaskHeaders');
      const taskHeader = findTaskHeader(taskHeaders, { key: 'header' });
      expect(taskHeader.get('value')).to.match(uuidRegex, 'task header is not a uuid');

      const taskDefinition = findExtension(bo, 'zeebe:TaskDefinition');
      expect(taskDefinition.get('type')).to.match(uuidRegex, 'task definition type is not a uuid');
    }));


    it('should apply generated values on message (uuid)', inject(function(templateElementFactory) {

      // given
      const uuidRegex = /^[\w\d]{8}(-[\w\d]{4}){3}-[\w\d]{12}$/;
      const elementTemplate = findTemplate('generatedEvent');

      // when
      const element = templateElementFactory.create(elementTemplate);

      // then
      const bo = getBusinessObject(element);

      const message = findMessage(bo);
      expect(message.get('name')).to.match(uuidRegex, 'message name is not a uuid');

      const subscription = findZeebeSubscription(message);
      expect(subscription.get('correlationKey')).to.match(uuidRegex, 'correlation key is not a uuid');
    }));
  });


  describe('completion condition', function() {

    it('should create element with completion condition', inject(function(templateElementFactory) {

      // given
      const elementTemplate = completionConditionTemplates[0];

      // when
      const element = templateElementFactory.create(elementTemplate);
      const businessObject = getBusinessObject(element);

      // then
      const completionCondition = businessObject.get('completionCondition');
      expect(completionCondition).to.exist;
      expect(is(completionCondition, 'bpmn:Expression'), 'should be a BPMN expression').to.be.true;
    }));
  });

});


// helper ////////////////

function findTemplate(id) {
  return find(templates, t => t.id === id);
}

function expectTaskDefinitionType(businessObject, type, result = true) {
  const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

  expect(taskDefinition, `#${businessObject.id} -> zeebe:taskDefinition`).to.exist;

  result ?
    expect(taskDefinition.type).to.eql(type)
    : expect(taskDefinition.type).to.not.eql(type);
}

function expectInputSource(businessObject, source, result = true) {
  const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');

  result && expect(ioMapping, `#${businessObject.id} -> zeebe:ioMapping`).to.exist;

  const inputs = ioMapping && ioMapping.get('zeebe:inputParameters') || [];

  result ?
    expect(inputs.find(input => input.source === source)).to.exist
    : expect(inputs.find(input => input.source === source)).to.not.exist;
}

function expectOutputTarget(businessObject, target, result = true) {
  const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');
  const outputs = ioMapping.get('zeebe:outputParameters');

  result ?
    expect(outputs.find(output => output.target === target)).to.exist
    : expect(outputs.find(output => output.target === target)).to.not.exist;
}


function expectTaskHeaderValue(businessObject, value, result = true) {
  const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders').get('values');

  result ?
    expect(taskHeaders.find(taskHeader => taskHeader.value === value)).to.exist
    : expect(taskHeaders.find(taskHeader => taskHeader.value === value)).to.not.exist;
}

function expectZeebePropertyValue(businessObject, value, result = true) {
  const zeebePropertiesExtension = findExtension(businessObject, 'zeebe:Properties');
  const properties = zeebePropertiesExtension.get('zeebe:properties');

  result ?
    expect(properties.find(property => property.value === value)).to.exist
    : expect(properties.find(property => property.value === value)).to.not.exist;
}
