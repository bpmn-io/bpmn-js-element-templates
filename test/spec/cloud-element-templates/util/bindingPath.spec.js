import { expect } from 'chai';

import { BpmnModdle } from 'bpmn-moddle';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';

import { getBindingPath } from 'src/cloud-element-templates/util/bindingPath';


describe('cloud-element-templates/util - bindingPath', function() {

  const moddle = new BpmnModdle({
    zeebe: zeebeModdlePackage
  });

  function create(type, properties) {
    return moddle.create(type, properties);
  }

  function withExtensionElements(values) {
    return create('bpmn:ExtensionElements', { values });
  }


  describe('#getBindingPath', function() {

    describe('property', function() {

      it('should resolve a plain BPMN property', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1', name: 'foo' });

        const binding = { type: 'property', name: 'name' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'name' ]);
      });


      it('should resolve a FEEL expression property to its holding field', function() {

        // given
        const condition = create('bpmn:FormalExpression', { body: '=foo' });

        const sequenceFlow = create('bpmn:SequenceFlow', {
          id: 'SequenceFlow_1',
          conditionExpression: condition
        });

        const binding = { type: 'property', name: 'conditionExpression' };

        // when
        const path = getBindingPath(sequenceFlow, binding);

        // then
        expect(path).to.eql([ 'conditionExpression' ]);
      });

    });


    describe('zeebe:input', function() {

      it('should resolve source', function() {

        // given
        const input = create('zeebe:Input', { source: '=foo', target: 'bar' });

        const ioMapping = create('zeebe:IoMapping', { inputParameters: [ input ] });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ ioMapping ])
        });

        const binding = { type: 'zeebe:input', name: 'bar' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'inputParameters', 0, 'source' ]);
      });


      it('should resolve the collection index of the matching input', function() {

        // given
        const inputs = [
          create('zeebe:Input', { source: '=1', target: 'a' }),
          create('zeebe:Input', { source: '=2', target: 'b' })
        ];

        const ioMapping = create('zeebe:IoMapping', { inputParameters: inputs });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ ioMapping ])
        });

        const binding = { type: 'zeebe:input', name: 'b' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'inputParameters', 1, 'source' ]);
      });


      it('should return null when unbound', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        const binding = { type: 'zeebe:input', name: 'bar' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.be.null;
      });

    });


    describe('zeebe:output', function() {

      it('should resolve target', function() {

        // given
        const output = create('zeebe:Output', { source: '=foo', target: 'bar' });

        const ioMapping = create('zeebe:IoMapping', { outputParameters: [ output ] });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ ioMapping ])
        });

        const binding = { type: 'zeebe:output', source: '=foo' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'outputParameters', 0, 'target' ]);
      });

    });


    describe('zeebe:taskHeader', function() {

      it('should resolve value', function() {

        // given
        const header = create('zeebe:Header', { key: 'foo', value: 'bar' });

        const taskHeaders = create('zeebe:TaskHeaders', { values: [ header ] });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ taskHeaders ])
        });

        const binding = { type: 'zeebe:taskHeader', key: 'foo' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'values', 0, 'value' ]);
      });

    });


    describe('zeebe:property', function() {

      it('should resolve value', function() {

        // given
        const property = create('zeebe:Property', { name: 'foo', value: 'bar' });

        const properties = create('zeebe:Properties', { properties: [ property ] });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ properties ])
        });

        const binding = { type: 'zeebe:property', name: 'foo' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'properties', 0, 'value' ]);
      });

    });


    describe('zeebe:taskDefinition', function() {

      it('should resolve type', function() {

        // given
        const taskDefinition = create('zeebe:TaskDefinition', { type: 'foo' });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ taskDefinition ])
        });

        const binding = { type: 'zeebe:taskDefinition:type' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'type' ]);
      });


      it('should resolve a task definition property', function() {

        // given
        const taskDefinition = create('zeebe:TaskDefinition', { type: 'foo', retries: '3' });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ taskDefinition ])
        });

        const binding = { type: 'zeebe:taskDefinition', property: 'retries' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'retries' ]);
      });

    });


    describe('bpmn:Message#property', function() {

      it('should resolve name via an event definition', function() {

        // given
        const message = create('bpmn:Message', { name: 'foo' });

        const messageEventDefinition = create('bpmn:MessageEventDefinition', { messageRef: message });

        const startEvent = create('bpmn:StartEvent', {
          id: 'StartEvent_1',
          eventDefinitions: [ messageEventDefinition ]
        });

        const binding = { type: 'bpmn:Message#property', name: 'name' };

        // when
        const path = getBindingPath(startEvent, binding);

        // then
        expect(path).to.eql([ 'eventDefinitions', 0, 'messageRef', 'name' ]);
      });


      it('should resolve name directly on a non-event element (receive task)', function() {

        // given
        const message = create('bpmn:Message', { name: 'foo' });

        const receiveTask = create('bpmn:ReceiveTask', {
          id: 'ReceiveTask_1',
          messageRef: message
        });

        const binding = { type: 'bpmn:Message#property', name: 'name' };

        // when
        const path = getBindingPath(receiveTask, binding);

        // then
        expect(path).to.eql([ 'messageRef', 'name' ]);
      });


      it('should return null when no message is referenced', function() {

        // given
        const startEvent = create('bpmn:StartEvent', {
          id: 'StartEvent_1',
          eventDefinitions: [ create('bpmn:MessageEventDefinition') ]
        });

        const binding = { type: 'bpmn:Message#property', name: 'name' };

        // when
        const path = getBindingPath(startEvent, binding);

        // then
        expect(path).to.be.null;
      });

    });


    describe('bpmn:Message#zeebe:subscription#property', function() {

      it('should resolve correlation key', function() {

        // given
        const subscription = create('zeebe:Subscription', { correlationKey: '=foo' });

        const message = create('bpmn:Message', {
          name: 'foo',
          extensionElements: withExtensionElements([ subscription ])
        });

        const messageEventDefinition = create('bpmn:MessageEventDefinition', { messageRef: message });

        const startEvent = create('bpmn:StartEvent', {
          id: 'StartEvent_1',
          eventDefinitions: [ messageEventDefinition ]
        });

        const binding = { type: 'bpmn:Message#zeebe:subscription#property', name: 'correlationKey' };

        // when
        const path = getBindingPath(startEvent, binding);

        // then
        expect(path).to.eql([
          'eventDefinitions', 0, 'messageRef', 'extensionElements', 'values', 0, 'correlationKey'
        ]);
      });

    });


    describe('bpmn:Signal#property', function() {

      it('should resolve name via an event definition', function() {

        // given
        const signal = create('bpmn:Signal', { name: 'foo' });

        const signalEventDefinition = create('bpmn:SignalEventDefinition', { signalRef: signal });

        const throwEvent = create('bpmn:IntermediateThrowEvent', {
          id: 'IntermediateThrowEvent_1',
          eventDefinitions: [ signalEventDefinition ]
        });

        const binding = { type: 'bpmn:Signal#property', name: 'name' };

        // when
        const path = getBindingPath(throwEvent, binding);

        // then
        expect(path).to.eql([ 'eventDefinitions', 0, 'signalRef', 'name' ]);
      });

    });


    describe('zeebe:calledElement', function() {

      it('should resolve processId', function() {

        // given
        const calledElement = create('zeebe:CalledElement', { processId: 'foo' });

        const callActivity = create('bpmn:CallActivity', {
          id: 'CallActivity_1',
          extensionElements: withExtensionElements([ calledElement ])
        });

        const binding = { type: 'zeebe:calledElement', property: 'processId' };

        // when
        const path = getBindingPath(callActivity, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'processId' ]);
      });

    });


    describe('zeebe:calledDecision', function() {

      it('should resolve decisionId', function() {

        // given
        const calledDecision = create('zeebe:CalledDecision', { decisionId: 'foo' });

        const businessRuleTask = create('bpmn:BusinessRuleTask', {
          id: 'BusinessRuleTask_1',
          extensionElements: withExtensionElements([ calledDecision ])
        });

        const binding = { type: 'zeebe:calledDecision', property: 'decisionId' };

        // when
        const path = getBindingPath(businessRuleTask, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'decisionId' ]);
      });

    });


    describe('zeebe:formDefinition', function() {

      it('should resolve formId', function() {

        // given
        const formDefinition = create('zeebe:FormDefinition', { formId: 'foo' });

        const userTask = create('bpmn:UserTask', {
          id: 'UserTask_1',
          extensionElements: withExtensionElements([ formDefinition ])
        });

        const binding = { type: 'zeebe:formDefinition', property: 'formId' };

        // when
        const path = getBindingPath(userTask, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'formId' ]);
      });

    });


    describe('zeebe:script', function() {

      it('should resolve expression', function() {

        // given
        const script = create('zeebe:Script', { expression: '=foo' });

        const scriptTask = create('bpmn:ScriptTask', {
          id: 'ScriptTask_1',
          extensionElements: withExtensionElements([ script ])
        });

        const binding = { type: 'zeebe:script', property: 'expression' };

        // when
        const path = getBindingPath(scriptTask, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'expression' ]);
      });

    });


    describe('zeebe:assignmentDefinition', function() {

      it('should resolve assignee', function() {

        // given
        const assignmentDefinition = create('zeebe:AssignmentDefinition', { assignee: 'foo' });

        const userTask = create('bpmn:UserTask', {
          id: 'UserTask_1',
          extensionElements: withExtensionElements([ assignmentDefinition ])
        });

        const binding = { type: 'zeebe:assignmentDefinition', property: 'assignee' };

        // when
        const path = getBindingPath(userTask, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'assignee' ]);
      });

    });


    describe('zeebe:taskSchedule', function() {

      it('should resolve dueDate', function() {

        // given
        const taskSchedule = create('zeebe:TaskSchedule', { dueDate: '=foo' });

        const userTask = create('bpmn:UserTask', {
          id: 'UserTask_1',
          extensionElements: withExtensionElements([ taskSchedule ])
        });

        const binding = { type: 'zeebe:taskSchedule', property: 'dueDate' };

        // when
        const path = getBindingPath(userTask, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'dueDate' ]);
      });

    });


    describe('zeebe:priorityDefinition', function() {

      it('should resolve priority', function() {

        // given
        const priorityDefinition = create('zeebe:PriorityDefinition', { priority: '50' });

        const userTask = create('bpmn:UserTask', {
          id: 'UserTask_1',
          extensionElements: withExtensionElements([ priorityDefinition ])
        });

        const binding = { type: 'zeebe:priorityDefinition', property: 'priority' };

        // when
        const path = getBindingPath(userTask, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'priority' ]);
      });

    });


    describe('zeebe:adHoc', function() {

      it('should resolve activeElementsCollection', function() {

        // given
        const adHoc = create('zeebe:AdHoc', { activeElementsCollection: '=foo' });

        const adHocSubProcess = create('bpmn:AdHocSubProcess', {
          id: 'AdHocSubProcess_1',
          extensionElements: withExtensionElements([ adHoc ])
        });

        const binding = { type: 'zeebe:adHoc', property: 'activeElementsCollection' };

        // when
        const path = getBindingPath(adHocSubProcess, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'activeElementsCollection' ]);
      });

    });


    describe('zeebe:linkedResource', function() {

      it('should resolve the property of the matching linked resource', function() {

        // given
        const resources = [
          create('zeebe:LinkedResource', { linkName: 'link-1', resourceId: 'foo' }),
          create('zeebe:LinkedResource', { linkName: 'link-2', resourceId: 'bar' })
        ];

        const linkedResources = create('zeebe:LinkedResources', { values: resources });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ linkedResources ])
        });

        const binding = { type: 'zeebe:linkedResource', linkName: 'link-2', property: 'resourceId' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.eql([ 'extensionElements', 'values', 0, 'values', 1, 'resourceId' ]);
      });

    });


    describe('bpmn:ConditionalEventDefinition#property', function() {

      it('should resolve condition', function() {

        // given
        const conditionalEventDefinition = create('bpmn:ConditionalEventDefinition');

        const boundaryEvent = create('bpmn:BoundaryEvent', {
          id: 'BoundaryEvent_1',
          eventDefinitions: [ conditionalEventDefinition ]
        });

        const binding = { type: 'bpmn:ConditionalEventDefinition#property', name: 'condition' };

        // when
        const path = getBindingPath(boundaryEvent, binding);

        // then
        expect(path).to.eql([ 'eventDefinitions', 0, 'condition' ]);
      });

    });


    describe('bpmn:ConditionalEventDefinition#zeebe:conditionalFilter#property', function() {

      it('should resolve variableEvents', function() {

        // given
        const conditionalFilter = create('zeebe:ConditionalFilter', { variableEvents: 'foo' });

        const conditionalEventDefinition = create('bpmn:ConditionalEventDefinition', {
          extensionElements: withExtensionElements([ conditionalFilter ])
        });

        const boundaryEvent = create('bpmn:BoundaryEvent', {
          id: 'BoundaryEvent_1',
          eventDefinitions: [ conditionalEventDefinition ]
        });

        const binding = { type: 'bpmn:ConditionalEventDefinition#zeebe:conditionalFilter#property', name: 'variableEvents' };

        // when
        const path = getBindingPath(boundaryEvent, binding);

        // then
        expect(path).to.eql([
          'eventDefinitions', 0, 'extensionElements', 'values', 0, 'variableEvents'
        ]);
      });

    });


    describe('unsupported bindings', function() {

      it('should return null for an unknown binding type', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        const binding = { type: 'zeebe:executionListener', eventType: 'start' };

        // when
        const path = getBindingPath(task, binding);

        // then
        expect(path).to.be.null;
      });

    });


    describe('returns null when the bound location is absent', function() {

      it('extension element missing', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, { type: 'zeebe:taskDefinition:type' });

        // then
        expect(path).to.be.null;
      });


      it('input parameter not matched', function() {

        // given
        const ioMapping = create('zeebe:IoMapping', {
          inputParameters: [ create('zeebe:Input', { target: 'other', source: '=x' }) ]
        });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ ioMapping ])
        });

        // when
        const path = getBindingPath(task, { type: 'zeebe:input', name: 'bar' });

        // then
        expect(path).to.be.null;
      });


      it('output parameter not matched', function() {

        // given
        const ioMapping = create('zeebe:IoMapping', {
          outputParameters: [ create('zeebe:Output', { source: '=other', target: 'x' }) ]
        });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ ioMapping ])
        });

        // when
        const path = getBindingPath(task, { type: 'zeebe:output', source: '=foo' });

        // then
        expect(path).to.be.null;
      });


      it('task headers extension missing', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, { type: 'zeebe:taskHeader', key: 'foo' });

        // then
        expect(path).to.be.null;
      });


      it('task header not matched', function() {

        // given
        const taskHeaders = create('zeebe:TaskHeaders', {
          values: [ create('zeebe:Header', { key: 'other', value: 'x' }) ]
        });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ taskHeaders ])
        });

        // when
        const path = getBindingPath(task, { type: 'zeebe:taskHeader', key: 'foo' });

        // then
        expect(path).to.be.null;
      });


      it('zeebe properties extension missing', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, { type: 'zeebe:property', name: 'foo' });

        // then
        expect(path).to.be.null;
      });


      it('zeebe property not matched', function() {

        // given
        const zeebeProperties = create('zeebe:Properties', {
          properties: [ create('zeebe:Property', { name: 'other', value: 'x' }) ]
        });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ zeebeProperties ])
        });

        // when
        const path = getBindingPath(task, { type: 'zeebe:property', name: 'foo' });

        // then
        expect(path).to.be.null;
      });


      it('linked resources extension missing', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, {
          type: 'zeebe:linkedResource', linkName: 'link-2', property: 'resourceId'
        });

        // then
        expect(path).to.be.null;
      });


      it('linked resource not matched', function() {

        // given
        const linkedResources = create('zeebe:LinkedResources', {
          values: [ create('zeebe:LinkedResource', { linkName: 'other', resourceId: 'x' }) ]
        });

        const task = create('bpmn:ServiceTask', {
          id: 'ServiceTask_1',
          extensionElements: withExtensionElements([ linkedResources ])
        });

        // when
        const path = getBindingPath(task, {
          type: 'zeebe:linkedResource', linkName: 'link-2', property: 'resourceId'
        });

        // then
        expect(path).to.be.null;
      });


      it('message missing (subscription binding)', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, {
          type: 'bpmn:Message#zeebe:subscription#property', name: 'correlationKey'
        });

        // then
        expect(path).to.be.null;
      });


      it('subscription missing on message', function() {

        // given
        const message = create('bpmn:Message', { name: 'foo' });

        const receiveTask = create('bpmn:ReceiveTask', {
          id: 'ReceiveTask_1',
          messageRef: message
        });

        // when
        const path = getBindingPath(receiveTask, {
          type: 'bpmn:Message#zeebe:subscription#property', name: 'correlationKey'
        });

        // then
        expect(path).to.be.null;
      });


      it('signal missing', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, { type: 'bpmn:Signal#property', name: 'name' });

        // then
        expect(path).to.be.null;
      });


      it('conditional event definition missing (condition binding)', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, {
          type: 'bpmn:ConditionalEventDefinition#property', name: 'condition'
        });

        // then
        expect(path).to.be.null;
      });


      it('conditional event definition missing (filter binding)', function() {

        // given
        const task = create('bpmn:ServiceTask', { id: 'ServiceTask_1' });

        // when
        const path = getBindingPath(task, {
          type: 'bpmn:ConditionalEventDefinition#zeebe:conditionalFilter#property', name: 'variableEvents'
        });

        // then
        expect(path).to.be.null;
      });


      it('conditional filter missing', function() {

        // given
        const conditionalEventDefinition = create('bpmn:ConditionalEventDefinition');

        const boundaryEvent = create('bpmn:BoundaryEvent', {
          id: 'BoundaryEvent_1',
          eventDefinitions: [ conditionalEventDefinition ]
        });

        // when
        const path = getBindingPath(boundaryEvent, {
          type: 'bpmn:ConditionalEventDefinition#zeebe:conditionalFilter#property', name: 'variableEvents'
        });

        // then
        expect(path).to.be.null;
      });

    });

  });

});
