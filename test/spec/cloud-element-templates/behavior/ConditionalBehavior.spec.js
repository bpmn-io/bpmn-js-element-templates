import TestContainer from 'mocha-test-container-support';
import { expect } from 'chai';

import { act } from '@testing-library/preact';

import {
  bootstrapModeler,
  bootstrapPropertiesPanel,
  inject
} from '../../../TestHelper';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesModule from 'src/cloud-element-templates';
import modelingModule from 'bpmn-js/lib/features/modeling';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';
import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';

import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';

import diagramXML from '../fixtures/condition.bpmn';
import messageDiagramXML from '../fixtures/condition-message.bpmn';
import messageCorrelationDiagramXML from '../fixtures/message-correlation-key.bpmn';
import signalDiagramXML from '../fixtures/condition-signal.bpmn';

import template from '../fixtures/condition.json';
import updateTemplates from '../fixtures/condition-update.json';
import chainedConditionsSimpleTemplate from '../fixtures/condition-chained.json';
import chainedConditionsComplexTemplate from './ConditionalBehavior.condition-chained.json';
import chainedConditionsSharedBindingTemplate from './ConditionalBehavior.condition-chained-shared-binding.json';
import dependentDropdownsTemplate from './ConditionalBehavior.dependent-dropdowns.json';
import booleanTemplate from '../fixtures/condition-boolean.json';
import numberTemplate from '../fixtures/condition-number.json';

import messageTemplates from '../fixtures/condition-message.json';
import messageCorrelationTemplate from '../fixtures/message-correlation-key.json';
import signalTemplates from '../fixtures/condition-signal.json';

import calledElementTemplate from '../fixtures/condition-called-element.json';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import { findExtension, findMessage, findSignal, findZeebeSubscription } from 'src/cloud-element-templates/Helper';
import ConditionalBehavior from 'src/cloud-element-templates/behavior/ConditionalBehavior';
import { getBpmnJS } from 'bpmn-js/test/helper';
import { isString } from 'min-dash';
import { query as domQuery } from 'min-dom';


describe('provider/cloud-element-templates - ConditionalBehavior', function() {

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
      BpmnPropertiesPanelModule,
      {
        propertiesPanel: [ 'value', { registerProvider() {} } ]
      },
      ZeebeBehaviorsModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    }
  }));


  describe('update property', function() {

    it('should add conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        // then
        expect(businessObject.get('customProperty')).to.exist;

        // empty values are not persisted in XML
        expect(businessObject.get('noDefaultProperty')).not.to.exist;

        expect(businessObject.get('isActiveCondition')).to.exist;
        expect(businessObject.get('isActiveCondition')).to.equal('otherProperty visible');
      })
    );


    it('should remove conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);

        // when
        modeling.updateProperties(element, {
          name: ''
        });

        // then
        const businessObject = getBusinessObject(element);

        expect(businessObject.get('customProperty')).to.be.undefined;
        expect(businessObject.get('isActiveCondition')).to.be.undefined;
      })
    );


    it('should switch between conditional properties', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        // then
        expectPropertyValue(businessObject, 'nameProp=foo');

        // when
        modeling.updateProperties(element, {
          name: 'bar'
        });

        // then
        expectPropertyValue(businessObject, 'nameProp=bar');
      })
    );


    it('should update conditional feel property (missing equal sign)', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', dependentDropdownsTemplate);
        const businessObject = getBusinessObject(element);

        modeling.updateModdleProperties(element, businessObject, {
          root: 'Root A',
        });

        // assume
        expect(businessObject.get('root')).to.eql('Root A');
        expect(businessObject.get('feel-value')).to.eql('=broken');

        // when
        modeling.updateModdleProperties(element, businessObject, {
          root: 'Root B',
        });

        // then
        expect(businessObject.get('root')).to.eql('Root B');
        expect(businessObject.get('feel-value')).to.eql('=correct');
      })
    );


    it('undo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_1', template);
      const businessObject = getBusinessObject(element);

      // when
      modeling.updateProperties(element, {
        name: 'foo'
      });

      // assume
      expect(businessObject.get('customProperty')).to.exist;

      // when
      commandStack.undo();

      expect(businessObject.get('customProperty')).to.be.undefined;
    }));


    it('redo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_1', template);

      // when
      modeling.updateProperties(element, {
        name: 'foo'
      });

      const businessObject = getBusinessObject(element);

      // when
      commandStack.undo();

      // assume
      expect(businessObject.get('customProperty')).to.be.undefined;

      // when
      commandStack.redo();

      // then
      expect(businessObject.get('customProperty')).to.exist;

    }));

  });


  describe('update zeebe:taskDefinition:type and zeebe:taskDefinition', function() {

    it('should add conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        const businessObject = getBusinessObject(element);
        const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

        // then
        expect(taskDefinition).to.exist;
      })
    );


    it('should remove conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);

        // when
        modeling.updateProperties(element, {
          name: ''
        });

        const businessObject = getBusinessObject(element);
        const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

        // then
        expect(taskDefinition).to.be.undefined;
      })
    );


    it('should switch between conditional properties', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        // then
        expectTaskDefinitionType(businessObject, 'nameProp=foo');

        // when
        modeling.updateProperties(element, {
          name: 'foobar'
        });

        // then
        expectTaskDefinitionType(businessObject, 'nameProp=foobar');
      })
    );


    it('undo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_2', template);

      // when
      modeling.updateProperties(element, {
        name: ''
      });

      const businessObject = getBusinessObject(element);

      // then
      expect(findExtension(businessObject, 'zeebe:TaskDefinition')).to.be.undefined;

      // when
      commandStack.undo();

      expect(findExtension(businessObject, 'zeebe:TaskDefinition')).to.exist;
    }));


    it('redo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_2', template);

      // when
      modeling.updateProperties(element, {
        name: ''
      });

      const businessObject = getBusinessObject(element);

      // when
      commandStack.undo();

      expect(findExtension(businessObject, 'zeebe:TaskDefinition')).to.exist;

      // when
      commandStack.redo();

      // then
      expect(findExtension(businessObject, 'zeebe:TaskDefinition')).to.be.undefined;

    }));

  });


  describe('update zeebe:ioMapping', function() {

    it('should add conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');
        const inputs = ioMapping.get('zeebe:inputParameters');
        const outputs = ioMapping.get('zeebe:outputParameters');

        // then
        expect(inputs).to.have.lengthOf(1);
        expect(outputs).to.have.lengthOf(1);
      })
    );


    it('should remove conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'bar'
        });

        const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');
        const outputs = ioMapping.get('zeebe:outputParameters');

        // then
        expect(outputs).to.be.empty;
      })
    );


    it('should clear IO mapping if no input parameters', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: ''
        });

        const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');

        // then
        expect(ioMapping).to.be.undefined;
      })
    );


    it('should switch between conditional properties', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        // then
        expectOutputTarget(businessObject, 'nameProp=foo');

        // when
        modeling.updateProperties(element, {
          name: 'foobar'
        });

        // then
        expectOutputTarget(businessObject, 'nameProp=foobar');
      })
    );


    it('undo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_2', template);
      const businessObject = getBusinessObject(element);

      // when
      modeling.updateProperties(element, {
        name: ''
      });

      // assume
      expect(findExtension(businessObject, 'zeebe:IoMapping')).to.be.undefined;

      // when
      commandStack.undo();

      expect(findExtension(businessObject, 'zeebe:IoMapping')).to.exist;

    }));


    it('redo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_2', template);
      const businessObject = getBusinessObject(element);

      modeling.updateProperties(element, {
        name: ''
      });

      // when
      commandStack.undo();

      // assume
      expect(findExtension(businessObject, 'zeebe:IoMapping')).to.exist;

      // when
      commandStack.redo();

      // then
      expect(findExtension(businessObject, 'zeebe:IoMapping')).to.be.undefined;

    }));

  });


  describe('update zeebe:taskHeader', function() {

    it('should add conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders').get('values');

        // then
        expect(taskHeaders).to.have.lengthOf(1);
      })
    );


    it('should remove conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'bar'
        });

        const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders');

        // then
        expect(taskHeaders).to.be.undefined;
      })
    );


    it('should clear taskHeaders if no task headers', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'bar'
        });

        const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders');

        // then
        expect(taskHeaders).to.be.undefined;
      })
    );


    it('should switch between conditional properties', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        // then
        expectTaskHeaderValue(businessObject, 'nameProp=foo');

        // when
        modeling.updateProperties(element, {
          name: 'foobar'
        });

        // then
        expectTaskHeaderValue(businessObject, 'nameProp=foobar');
      })
    );


    it('undo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_1', template);
      const businessObject = getBusinessObject(element);

      // when
      modeling.updateProperties(element, {
        name: 'foo'
      });

      // assume
      expect(findExtension(businessObject, 'zeebe:TaskHeaders')).to.exist;

      // when
      commandStack.undo();

      // then
      expect(findExtension(businessObject, 'zeebe:TaskHeaders')).not.to.exist;

    }));


    it('redo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_1', template);
      const businessObject = getBusinessObject(element);

      // when
      modeling.updateProperties(element, {
        name: 'foo'
      });

      commandStack.undo();

      // assume
      expect(findExtension(businessObject, 'zeebe:TaskHeaders')).not.to.exist;

      // when
      commandStack.redo();

      // then
      expect(findExtension(businessObject, 'zeebe:TaskHeaders')).to.exist;
    }));

  });


  describe('update zeebe:property', function() {

    describe('adding conditional entries', function() {

      it('should add conditional entries', inject(
        async function(modeling) {

          // given
          const element = changeTemplate('Task_1', template);
          const businessObject = getBusinessObject(element);

          // when
          modeling.updateProperties(element, {
            name: 'foo'
          });

          // then
          const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');

          expect(zeebeProperties).to.exist;
          expect(zeebeProperties.get('zeebe:properties')).to.have.lengthOf(1);
        })
      );


      it('should switch between conditional properties', inject(
        async function(modeling) {

          // given
          const element = changeTemplate('Task_1', template);
          const businessObject = getBusinessObject(element);

          // when
          modeling.updateProperties(element, {
            name: 'foo'
          });

          // then
          expectZeebePropertyValue(businessObject, '');

          // when
          modeling.updateProperties(element, {
            name: 'foobar'
          });

          // then
          expectZeebePropertyValue(businessObject, 'nameProp=foobar');
        })
      );


      it('undo', inject(function(commandStack, modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        // assume
        expect(findExtension(businessObject, 'zeebe:Properties')).to.exist;

        // when
        commandStack.undo();

        // then
        expect(findExtension(businessObject, 'zeebe:Properties')).not.to.exist;
      }));


      it('redo', inject(function(commandStack, modeling) {

        // given
        const element = changeTemplate('Task_1', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        commandStack.undo();

        // assume
        expect(findExtension(businessObject, 'zeebe:TaskHeaders')).not.to.exist;

        // when
        commandStack.redo();

        // then
        const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');

        expect(zeebeProperties).to.exist;
        expect(zeebeProperties.get('zeebe:properties')).to.have.lengthOf(1);
      }));

    });


    it('should remove conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_2', template);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'bar'
        });

        // then
        const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');
        expect(zeebeProperties).not.to.exist;
      })
    );

  });


  describe('update bpmn:Message#property', function() {

    const template = messageTemplates[0];

    beforeEach(bootstrapModeler(messageDiagramXML, {
      container: container,
      modules: [
        coreModule,
        elementTemplatesModule,
        modelingModule,
        ConditionalBehavior,
        BpmnPropertiesPanelModule,
        {
          propertiesPanel: [ 'value', { registerProvider() {} } ]
        }
      ],
      moddleExtensions: {
        zeebe: zeebeModdlePackage
      }
    }));

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set([ template ]);
    }));


    it('should add conditional entries', inject(async function() {

      // when
      const element = changeTemplate('Event_3', template);

      // then
      const message = findMessage(getBusinessObject(element));

      expect(message).to.have.property('name', 'one');
    }));


    it('should remove conditional entries', inject(
      async function(elementRegistry, modeling) {

        // given
        const element = elementRegistry.get('Event_1');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });

        // then
        const message = findMessage(getBusinessObject(element));

        expect(message).not.to.have.property('name');
      })
    );


    it('should switch between conditional properties', inject(
      async function(elementRegistry, modeling) {

        // given
        const element = elementRegistry.get('Event_1');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'two'
        });

        // then
        const message = findMessage(getBusinessObject(element));

        expect(message).to.have.property('name', 'two');
      })
    );


    it('undo', inject(function(commandStack, elementRegistry, modeling) {

      // given
      let element = elementRegistry.get('Event_1');
      const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: 'three'
      });

      // assume
      const message = findMessage(getBusinessObject(element));
      expect(message).not.to.have.property('name');

      // when
      commandStack.undo();

      expect(message).to.have.property('name', 'one');
    }));


    it('redo', inject(function(commandStack, elementRegistry, modeling) {

      // given
      let element = elementRegistry.get('Event_1');
      const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: 'three'
      });

      // assume
      const message = findMessage(getBusinessObject(element));

      // when
      commandStack.undo();

      // assume
      expect(message).to.have.property('name', 'one');

      // when
      commandStack.redo();

      // then
      expect(message).not.to.have.property('name');
    }));


    it('should set zeebe:modelerTemplate on created message', inject(function() {

      // when
      const element = changeTemplate('Event_3', template);

      // then
      const message = findMessage(getBusinessObject(element));

      expect(message.get('zeebe:modelerTemplate')).to.eql(template.id);
    }));
  });


  describe('update bpmn:Message#zeebe:subscription#property', function() {

    const template = messageTemplates[1];

    beforeEach(bootstrapModeler(messageDiagramXML, {
      container: container,
      modules: [
        coreModule,
        elementTemplatesModule,
        modelingModule,
        ConditionalBehavior,
        BpmnPropertiesPanelModule,
        {
          propertiesPanel: [ 'value', { registerProvider() {} } ]
        },
        ZeebeBehaviorsModule
      ],
      moddleExtensions: {
        zeebe: zeebeModdlePackage
      }
    }));

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set([ template ]);
    }));


    describe('correlationKey visibility', function() {

      beforeEach(bootstrapPropertiesPanel(messageCorrelationDiagramXML, {
        container: container,
        modules: [
          coreModule,
          elementTemplatesModule,
          modelingModule,
          BpmnPropertiesPanelModule,
          ZeebeBehaviorsModule
        ],
        moddleExtensions: {
          zeebe: zeebeModdlePackage
        }
      }));

      beforeEach(inject(function(elementTemplates) {
        elementTemplates.set([ messageCorrelationTemplate ]);
      }));


      it('should show correlation key - MessageStartSubprocess', inject(async function(selection) {

        // when
        const element = changeTemplate('MessageStartSubprocess', messageCorrelationTemplate);
        await act(() => selection.select(element));

        // then
        const correlationKeyEntry = domQuery('[data-entry-id="custom-entry-message-correlation-key-rendering-1"]', container);
        expect(correlationKeyEntry).to.exist;
      }));


      it('should NOT show correlation key', inject(async function(selection) {

        // when
        const element = changeTemplate('MessageStart', messageCorrelationTemplate);
        await act(() => selection.select(element));

        // then
        const correlationKeyEntry = domQuery('[data-entry-id="custom-entry-message-correlation-key-rendering-1"]', container);
        expect(correlationKeyEntry).not.to.exist;
      }));

    });


    it('should add conditional entries', inject(async function() {

      // when
      const element = changeTemplate('SubscriptionEvent_3', template);

      // then
      const message = findMessage(getBusinessObject(element));
      const subscription = findZeebeSubscription(message);

      expect(subscription).to.have.property('correlationKey', 'one');
    }));


    it('should remove conditional entries', inject(
      async function(elementRegistry, modeling) {

        // given
        const element = elementRegistry.get('SubscriptionEvent_1');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });

        // then
        const message = findMessage(getBusinessObject(element));
        const subscription = findZeebeSubscription(message);

        expect(subscription).not.to.exist;
      })
    );


    it('should switch between conditional properties', inject(
      async function(elementRegistry, modeling) {

        // given
        const element = elementRegistry.get('SubscriptionEvent_1');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'two'
        });

        // then
        const message = findMessage(getBusinessObject(element));
        const subscription = findZeebeSubscription(message);

        expect(subscription).to.have.property('correlationKey', 'two');
      })
    );


    it('undo', inject(function(commandStack, elementRegistry, modeling) {

      // given
      const element = elementRegistry.get('SubscriptionEvent_1');
      const businessObject = getBusinessObject(element);
      const property = findExtension(businessObject, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: 'three'
      });

      // assume
      let subscription = findZeebeSubscription(findMessage(businessObject));
      expect(subscription).to.not.exist;

      // when
      commandStack.undo();

      subscription = findZeebeSubscription(findMessage(businessObject));
      expect(subscription).to.have.property('correlationKey', 'one');
    }));


    it('redo', inject(function(commandStack, elementRegistry, modeling) {

      // given
      const element = elementRegistry.get('SubscriptionEvent_1');
      const businessObject = getBusinessObject(element);
      const property = findExtension(businessObject, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: 'three'
      });

      // assume
      let subscription = findZeebeSubscription(findMessage(businessObject));
      expect(subscription).to.not.exist;

      // when
      commandStack.undo();

      // assume
      subscription = findZeebeSubscription(findMessage(businessObject));
      expect(subscription).to.have.property('correlationKey', 'one');

      // when
      commandStack.redo();

      // then
      subscription = findZeebeSubscription(findMessage(businessObject));
      expect(subscription).to.not.exist;
    }));


    it('should set zeebe:modelerTemplate on created message', inject(function() {

      // when
      const element = changeTemplate('SubscriptionEvent_3', template);

      // then
      const message = findMessage(getBusinessObject(element));

      expect(message.get('zeebe:modelerTemplate')).to.eql(template.id);
    }));

  });


  describe('update zeebe:calledElement', function() {

    it('should add conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', calledElementTemplate);
        const businessObject = getBusinessObject(element);

        // when
        modeling.updateProperties(element, {
          name: 'foo'
        });

        const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

        // then
        expect(calledElement).to.have.property('processId', 'one');
      })
    );


    it('should remove conditional entries', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', calledElementTemplate);
        const businessObject = getBusinessObject(element);

        modeling.updateProperties(element, {
          name: 'foo'
        });

        // when
        modeling.updateProperties(element, {
          name: ''
        });

        const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

        // then
        expect(calledElement).not.to.exist;
      })
    );


    it('should switch between conditional properties', inject(
      async function(modeling) {

        // given
        const element = changeTemplate('Task_1', calledElementTemplate);
        const businessObject = getBusinessObject(element);

        modeling.updateProperties(element, {
          name: 'foo'
        });

        // when
        modeling.updateProperties(element, {
          name: 'bar'
        });

        const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

        // then
        expect(calledElement).to.have.property('processId', 'two');
      })
    );


    it('undo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_1', calledElementTemplate);
      const businessObject = getBusinessObject(element);

      modeling.updateProperties(element, {
        name: 'foo'
      });

      // when
      commandStack.undo();

      const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

      // then
      expect(calledElement).not.to.exist;
    }));


    it('redo', inject(function(commandStack, modeling) {

      // given
      const element = changeTemplate('Task_1', calledElementTemplate);
      const businessObject = getBusinessObject(element);

      modeling.updateProperties(element, {
        name: 'foo'
      });
      commandStack.undo();

      // when
      commandStack.redo();

      const calledElement = findExtension(businessObject, 'zeebe:CalledElement');

      // then
      expect(calledElement).to.have.property('processId', 'one');
    }));

  });


  describe('update referenced element', function() {

    const template = messageTemplates[2];

    beforeEach(bootstrapModeler(messageDiagramXML, {
      container: container,
      modules: [
        coreModule,
        elementTemplatesModule,
        modelingModule,
        ConditionalBehavior,
        BpmnPropertiesPanelModule,
        {
          propertiesPanel: [ 'value', { registerProvider() {} } ]
        }
      ],
      moddleExtensions: {
        zeebe: zeebeModdlePackage
      }
    }));

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set([ template ]);
    }));


    it('should remove bpmn:Message if none bpmn:Message bindings are left', inject(
      async function(elementRegistry, modeling, bpmnjs) {

        // given
        const element = elementRegistry.get('Event_4');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];
        const initialMessage = findMessage(getBusinessObject(element));
        const initialRootElements = bpmnjs.getDefinitions().get('rootElements');

        // assume
        expect(initialMessage).to.exist;

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });

        // then
        const message = findMessage(getBusinessObject(element));

        expect(message).not.to.exist;

        const rootElements = bpmnjs.getDefinitions().get('rootElements');
        expect(rootElements).to.have.lengthOf(initialRootElements.length - 1);
      })
    );


    it('should recreate bpmn:Message if message bindings are active again', inject(
      async function(elementRegistry, modeling, bpmnjs) {

        // given
        const element = elementRegistry.get('Event_4');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];
        const initialMessage = findMessage(getBusinessObject(element));
        const initialRootElements = bpmnjs.getDefinitions().get('rootElements');

        // assume
        expect(initialMessage).to.exist;

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });
        modeling.updateModdleProperties(element, property, {
          value: 'two'
        });

        // then
        const message = findMessage(getBusinessObject(element));
        expect(message).to.exist;

        const rootElements = bpmnjs.getDefinitions().get('rootElements');
        expect(rootElements).to.have.lengthOf(initialRootElements.length);
      })
    );
  });


  describe('update bpmn:Signal#property', function() {

    const template = signalTemplates[0];

    beforeEach(bootstrapModeler(signalDiagramXML, {
      container: container,
      modules: [
        coreModule,
        elementTemplatesModule,
        modelingModule,
        ConditionalBehavior,
        BpmnPropertiesPanelModule,
        {
          propertiesPanel: [ 'value', { registerProvider() {} } ]
        }
      ],
      moddleExtensions: {
        zeebe: zeebeModdlePackage
      }
    }));

    beforeEach(inject(function(elementTemplates) {
      elementTemplates.set([ template ]);
    }));


    it('should add conditional entries', inject(async function() {

      // when
      const element = changeTemplate('SignalEvent_3', template);

      // then
      const signal = findSignal(getBusinessObject(element));

      expect(signal).to.have.property('name', 'one');
    }));


    it('should remove conditional entries', inject(
      async function(elementRegistry, modeling) {

        // given
        const element = elementRegistry.get('SignalEvent_1');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });

        // then
        const signal = findSignal(getBusinessObject(element));

        expect(signal).not.to.have.property('name');
      })
    );


    it('should switch between conditional properties', inject(
      async function(elementRegistry, modeling) {

        // given
        const element = elementRegistry.get('SignalEvent_1');
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'two'
        });

        // then
        const signal = findSignal(getBusinessObject(element));

        expect(signal).to.have.property('name', 'two');
      })
    );


    it('undo', inject(function(commandStack, elementRegistry, modeling) {

      // given
      let element = elementRegistry.get('SignalEvent_1');
      const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: 'three'
      });

      // assume
      const signal = findSignal(getBusinessObject(element));
      expect(signal).not.to.have.property('name');

      // when
      commandStack.undo();

      expect(signal).to.have.property('name', 'one');
    }));


    it('redo', inject(function(commandStack, elementRegistry, modeling) {

      // given
      let element = elementRegistry.get('SignalEvent_1');
      const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: 'three'
      });

      // assume
      const signal = findSignal(getBusinessObject(element));

      // when
      commandStack.undo();

      // assume
      expect(signal).to.have.property('name', 'one');

      // when
      commandStack.redo();

      // then
      expect(signal).not.to.have.property('name');
    }));


    it('should set zeebe:modelerTemplate on created signal', inject(function() {

      // when
      const element = changeTemplate('SignalEvent_3', template);

      // then
      const signal = findSignal(getBusinessObject(element));

      expect(signal.get('zeebe:modelerTemplate')).to.eql(template.id);
    }));


    it('should remove bpmn:Signal if none bpmn:Signal bindings are left', inject(
      async function(elementRegistry, modeling, bpmnjs) {

        // given
        const template = signalTemplates[1];
        const element = changeTemplate('SignalEvent_3', template);
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];
        const initialSignal = findSignal(getBusinessObject(element));
        const initialRootElements = bpmnjs.getDefinitions().get('rootElements');

        // assume
        expect(initialSignal).to.exist;

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });

        // then
        const signal = findSignal(getBusinessObject(element));

        expect(signal).not.to.exist;

        const rootElements = bpmnjs.getDefinitions().get('rootElements');
        expect(rootElements).to.have.lengthOf(initialRootElements.length - 1);
      })
    );


    it('should recreate bpmn:Signal if signal bindings are active again', inject(
      async function(elementRegistry, modeling, bpmnjs) {

        // given
        const template = signalTemplates[1];
        const element = changeTemplate('SignalEvent_3', template);
        const property = findExtension(element, 'zeebe:Properties').get('properties')[0];
        const initialSignal = findSignal(getBusinessObject(element));
        const initialRootElements = bpmnjs.getDefinitions().get('rootElements');

        // assume
        expect(initialSignal).to.exist;

        // when
        modeling.updateModdleProperties(element, property, {
          value: 'three'
        });
        modeling.updateModdleProperties(element, property, {
          value: 'two'
        });

        // then
        const signal = findSignal(getBusinessObject(element));
        expect(signal).to.exist;

        const rootElements = bpmnjs.getDefinitions().get('rootElements');
        expect(rootElements).to.have.lengthOf(initialRootElements.length);
      })
    );
  });


  describe('update template', function() {

    it('should keep property value when condition property is still active', inject(function(modeling) {

      // given
      const element = changeTemplate('Task_1', updateTemplates[0]);

      modeling.updateProperties(element, {
        name: 'foo'
      });

      const businessObject = getBusinessObject(element);

      // assume
      expect(businessObject.get('customProperty')).to.exist;
      expect(businessObject.get('customProperty')).to.eql('defaultValue');


      // when
      modeling.updateProperties(element, {
        customProperty: 'customValue'
      });

      // assume
      expect(businessObject.get('customProperty')).to.eql('customValue');

      // when
      changeTemplate(element, updateTemplates[1], updateTemplates[0]);

      // then
      expect(businessObject.get('customProperty')).to.eql('customValue');

    }));

  });


  describe('chained conditional properties', function() {

    describe('simple', function() {

      it('should set when applying template', inject(
        function(modeling) {

          // when
          const element = changeTemplate('Task_1', chainedConditionsSimpleTemplate);

          // then
          const businessObject = getBusinessObject(element);

          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('foo');

          expect(businessObject.get('prop2')).to.exist;
          expect(businessObject.get('prop2')).to.eql('prop2:foo');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3:foo');
        }
      ));


      it('should set when updating property', inject(
        function(modeling) {

          // given
          const element = changeTemplate('Task_1', chainedConditionsSimpleTemplate);

          // when
          modeling.updateProperties(element, {
            prop1: 'bar'
          });

          // then
          const businessObject = getBusinessObject(element);

          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('bar');

          expect(businessObject.get('prop2')).to.exist;
          expect(businessObject.get('prop2')).to.eql('prop2_1:bar');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3_1:bar');
        }
      ));


      it('should set when updating moddle property', inject(
        function(modeling) {

          // given
          const element = changeTemplate(
            'Task_1', chainedConditionsSimpleTemplate
          );
          const businessObject = getBusinessObject(element);

          // when
          modeling.updateModdleProperties(element, businessObject, {
            prop1: 'bar'
          });

          // then
          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('bar');

          expect(businessObject.get('prop2')).to.exist;
          expect(businessObject.get('prop2')).to.eql('prop2_1:bar');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3_1:bar');
        }
      ));

    });


    describe('complex', function() {

      it('should set when applying template', inject(
        function() {

          // when
          const element = changeTemplate(
            'Task_1', chainedConditionsComplexTemplate
          );

          // then
          const businessObject = getBusinessObject(element);

          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('prop1:foo');

          expect(businessObject.get('prop2')).to.exist;
          expect(businessObject.get('prop2')).to.eql('prop2:foo');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3:foo');

          expect(businessObject.get('prop4')).to.exist;
          expect(businessObject.get('prop4')).to.eql('prop4:foo');

          expect(businessObject.get('prop5')).to.exist;
          expect(businessObject.get('prop5')).to.eql('prop5:foo');
        }
      ));


      it('should set when updating property', inject(
        function(modeling) {

          // given
          const element = changeTemplate(
            'Task_1', chainedConditionsComplexTemplate
          );

          // when
          modeling.updateProperties(element, {
            prop1: 'prop1:bar'
          });

          // then
          const businessObject = getBusinessObject(element);

          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('prop1:bar');

          expect(businessObject.get('prop2')).to.exist;
          expect(businessObject.get('prop2')).to.eql('prop2:foo');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3:bar');

          expect(businessObject.get('prop4')).to.exist;
          expect(businessObject.get('prop4')).to.eql('prop4:bar');

          expect(businessObject.get('prop5')).to.exist;
          expect(businessObject.get('prop5')).to.eql('prop5:bar');
        }
      ));


      it('should set when updating moddle property', inject(
        function(modeling) {

          // given
          const element = changeTemplate(
            'Task_1', chainedConditionsComplexTemplate
          );

          const businessObject = getBusinessObject(element);

          // when
          modeling.updateModdleProperties(element, businessObject, {
            prop1: 'prop1:bar'
          });

          // then
          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('prop1:bar');

          expect(businessObject.get('prop2')).to.exist;
          expect(businessObject.get('prop2')).to.eql('prop2:foo');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3:bar');

          expect(businessObject.get('prop4')).to.exist;
          expect(businessObject.get('prop4')).to.eql('prop4:bar');

          expect(businessObject.get('prop5')).to.exist;
          expect(businessObject.get('prop5')).to.eql('prop5:bar');
        }
      ));

    });


    describe('shared-binding', function() {

      it('should set when applying template', inject(
        function() {

          // when
          const element = changeTemplate(
            'Task_1', chainedConditionsSharedBindingTemplate
          );

          // then
          const businessObject = getBusinessObject(element);

          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('prop1:foo');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3_a:foo');

          // TODO(nikku): the following scenario is not the expected output
          // and currently broken:
          //
          //   [ prop4 -> prop4:bar | depends on prop3_b ] -
          //   It is only valid when prop3_b is active with a particular
          //   value, but due to the fact that another property [prop3_a]
          //   uses the same technical binding it activates regardless
          expect(businessObject.get('prop4')).to.to.exist;
          expect(businessObject.get('prop4')).to.eql('prop4:bar');
        }
      ));


      it('should set when updating property', inject(
        function(modeling) {

          // given
          const element = changeTemplate(
            'Task_1', chainedConditionsSharedBindingTemplate
          );

          // when
          modeling.updateProperties(element, {
            prop1: 'prop1:bar'
          });

          // then
          const businessObject = getBusinessObject(element);

          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('prop1:bar');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3_b:foo');

          expect(businessObject.get('prop4')).not.to.exist;
        }
      ));


      it('should set when updating moddle property', inject(
        function(modeling) {

          // given
          const element = changeTemplate('Task_1', chainedConditionsSharedBindingTemplate);
          const businessObject = getBusinessObject(element);

          // when
          modeling.updateModdleProperties(element, businessObject, {
            prop1: 'prop1:bar'
          });

          // then
          expect(businessObject.get('prop1')).to.exist;
          expect(businessObject.get('prop1')).to.eql('prop1:bar');

          expect(businessObject.get('prop3')).to.exist;
          expect(businessObject.get('prop3')).to.eql('prop3_b:foo');

          expect(businessObject.get('prop4')).not.to.exist;
        }
      ));

    });

  });


  describe('user input', function() {

    describe('should preserve valid <dropdown> values', function() {

      it('when applying template', inject(
        function(elementRegistry, modeling) {

          // given
          const element = elementRegistry.get('ServiceTask_1');
          const businessObject = getBusinessObject(element);

          modeling.updateModdleProperties(element, businessObject, {
            root: 'Root B',
            sub: '/B/2'
          });

          // assume
          expect(businessObject.get('root')).to.eql('Root B');
          expect(businessObject.get('sub')).to.eql('/B/2');

          // when
          const updatedElement = changeTemplate(element, dependentDropdownsTemplate);
          const updatedBusinessObject = getBusinessObject(updatedElement);

          // then
          expect(updatedBusinessObject.get('root')).to.eql('Root B');
          expect(updatedBusinessObject.get('sub')).to.eql('/B/2');
        }
      ));


      it('when upgrading template', inject(
        function(modeling) {

          // given
          const newTemplate = {
            ...dependentDropdownsTemplate,
            version: 2
          };

          const element = changeTemplate('ServiceTask_1', dependentDropdownsTemplate);
          const businessObject = getBusinessObject(element);

          modeling.updateModdleProperties(element, businessObject, {
            root: 'Root B',
            sub: '/B/2'
          });

          // assume
          expect(businessObject.get('root')).to.eql('Root B');
          expect(businessObject.get('sub')).to.eql('/B/2');

          // when
          const updatedElement = changeTemplate(element, newTemplate, dependentDropdownsTemplate);
          const updatedBusinessObject = getBusinessObject(updatedElement);

          // then
          expect(updatedBusinessObject.get('root')).to.eql('Root B');
          expect(updatedBusinessObject.get('sub')).to.eql('/B/2');
        }
      ));


      it('when changing template', inject(
        function(modeling) {

          // given
          const newTemplate = {
            ...dependentDropdownsTemplate,
            id: dependentDropdownsTemplate.id + '::v2'
          };

          const element = changeTemplate('ServiceTask_1', dependentDropdownsTemplate);
          const businessObject = getBusinessObject(element);

          modeling.updateModdleProperties(element, businessObject, {
            root: 'Root B',
            sub: '/B/2'
          });

          // assume
          expect(businessObject.get('root')).to.eql('Root B');
          expect(businessObject.get('sub')).to.eql('/B/2');

          // when
          const updatedElement = changeTemplate(element, newTemplate, dependentDropdownsTemplate);
          const updatedBusinessObject = getBusinessObject(updatedElement);

          // then
          expect(updatedBusinessObject.get('root')).to.eql('Root B');
          expect(updatedBusinessObject.get('sub')).to.eql('/B/2');
        }
      ));

    });

  });


  describe('conditions', function() {

    it('should keep property value when condition property is still active', inject(function(modeling) {

      // given
      const element = changeTemplate('Task_1', booleanTemplate);

      // assume
      expectTaskHeaderValue(getBusinessObject(element), 'inactive');

      // whem
      const property = findExtension(element, 'zeebe:Properties').get('properties')[0];

      // when
      modeling.updateModdleProperties(element, property, {
        value: true
      });

      // then
      expectTaskHeaderValue(getBusinessObject(element), 'active');

    }));


    describe('number', function() {

      it('should keep number property value when condition property is feel-static', inject(function() {

        // given
        const element = changeTemplate('Task_1', numberTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        expectZeebePropertyValueByKey(businessObject, 'text-static');
      }));


      it('should keep number property value when condition property is feel-optional', inject(function() {

        // given
        const element = changeTemplate('Task_1', numberTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        expectZeebePropertyValueByKey(businessObject, 'text-optional');
      }));


      it('should keep number property value when condition property is feel-required', inject(function() {

        // given
        const element = changeTemplate('Task_1', numberTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        expectZeebePropertyValueByKey(businessObject, 'text-required');
      }));


      it('should match when property type is Number but value is a numeric string and condition expects a Number', inject(function() {

        // given
        const element = changeTemplate('Task_1', numberTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        // Even though number-string = "100", its type is Number;
        // therefore, a compare-with-number property should be considered valid (number-string = 100).
        expectZeebePropertyValueByKey(businessObject, 'compare-with-number');
      }));


      it('should match number property with number value when condition has numeric value', inject(function() {

        // given
        const element = changeTemplate('Task_1', numberTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        expectZeebePropertyValueByKey(businessObject, 'compare-number-with-number');
      }));

    });


    describe('boolean', function() {

      // TODO(@jarekdanielak): To be implemented as part of
      // https://github.com/bpmn-io/bpmn-js-element-templates/issues/195
      it.skip('should match `true`', inject(function() {

        // given
        const element = changeTemplate('Task_1', booleanTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        expectZeebePropertyValueByKey(businessObject, 'booleanStaticProp', '=true');
        expectZeebePropertyValueByKey(businessObject, 'inputForActiveStaticCheckbox');

        const zeebeProperties = findExtension(element, 'zeebe:Properties').get('properties');
        console.log(zeebeProperties);

        expect(zeebeProperties.find(p => p.name === 'inputForInactiveStaticCheckbox')).to.not.exist;
      }));


      it('should match `false`');


      it('should match "=true"', inject(function() {

        // given
        const element = changeTemplate('Task_1', booleanTemplate);

        // when
        const businessObject = getBusinessObject(element);

        // then
        expectZeebePropertyValueByKey(businessObject, 'booleanStaticFeelProp', '=true');
        expectZeebePropertyValueByKey(businessObject, 'inputForActiveStaticFeelCheckbox');

        const zeebeProperties = findExtension(element, 'zeebe:Properties').get('properties');
        expect(zeebeProperties.find(p => p.name === 'inputForInactiveStaticFeelCheckbox')).to.not.exist;
      }));


      it('should match "=false"', inject(function(modeling) {

        // given
        const element = changeTemplate('Task_1', booleanTemplate);

        // when
        const property = findExtension(element, 'zeebe:Properties').get('properties').find(p => p.name === 'booleanStaticFeelProp');
        modeling.updateModdleProperties(element, property, {
          value: '=false'
        });

        // then
        const businessObject = getBusinessObject(element);
        expectZeebePropertyValueByKey(businessObject, 'booleanStaticFeelProp', '=false');
        expectZeebePropertyValueByKey(businessObject, 'inputForInactiveStaticFeelCheckbox');
      }));
    });
  });
});



// helpers //////////

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

function expectPropertyValue(businessObject, value) {
  const property = businessObject.get('customProperty');

  expect(property).to.exist;
  expect(property).to.eql(value);
}

function expectTaskDefinitionType(businessObject, type) {
  const taskDefinition = findExtension(businessObject, 'zeebe:TaskDefinition');

  expect(taskDefinition).to.exist;
  expect(taskDefinition.type).to.eql(type);
}

function expectOutputTarget(businessObject, target) {
  const ioMapping = findExtension(businessObject, 'zeebe:IoMapping');
  const outputs = ioMapping.get('zeebe:outputParameters');

  expect(outputs).to.have.lengthOf(1);
  expect(outputs[0].target).to.eql(target);
}


function expectTaskHeaderValue(businessObject, value) {
  const taskHeaders = findExtension(businessObject, 'zeebe:TaskHeaders').get('values');

  expect(taskHeaders).to.have.lengthOf(1);
  expect(taskHeaders[0].value).to.eql(value);
}

function expectZeebePropertyValue(businessObject, value) {
  const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');
  const properties = zeebeProperties.get('zeebe:properties');

  expect(zeebeProperties).to.exist;
  expect(properties).to.have.lengthOf(1);
  expect(properties[0].value).to.eql(value);
}

function expectZeebePropertyValueByKey(businessObject ,key, value) {
  const zeebeProperties = findExtension(businessObject, 'zeebe:Properties');
  const properties = zeebeProperties.get('zeebe:properties');

  const property = properties.find(p => p.name === key);

  expect(property).to.exist;

  if (value) {
    expect(property.value).to.eql(value);
  }
}