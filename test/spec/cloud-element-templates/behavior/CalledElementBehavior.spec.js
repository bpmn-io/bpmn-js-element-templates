import TestContainer from 'mocha-test-container-support';
import { expect } from 'chai';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';
import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';
import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe';
import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';

import {
  bootstrapModeler,
  inject
} from 'test/TestHelper';

import elementTemplatesModule from 'src/cloud-element-templates';
import { findExtension } from 'src/cloud-element-templates/Helper';

import diagramXML from './CalledElementBehavior.bpmn';
import templates from './CalledElementBehavior.json';


describe('CalledElementBehavior', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });


  beforeEach(bootstrapModeler(diagramXML, {
    container,
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
    },
    elementTemplates: templates
  }));


  describe('variable propagation', function() {

    it('should ensure no variable propagation when template is applied', inject(
      function(elementRegistry, elementTemplates) {

        // given
        let callActivity = elementRegistry.get('Task');

        // when
        callActivity = elementTemplates.applyTemplate(callActivity, templates[0]);

        // then
        expect(getPropagation(callActivity)).to.eql({
          propagateAllChildVariables: false,
          propagateAllParentVariables: false
        });
      })
    );


    it('should ensure no variable propagation when property is activated via condition', inject(
      function(elementRegistry, modeling) {

        // given
        const callActivity = elementRegistry.get('TemplatedNoProperty');

        // when
        modeling.updateProperties(callActivity, {
          name: 'foo'
        });

        expect(getPropagation(callActivity)).to.eql({
          propagateAllChildVariables: false,
          propagateAllParentVariables: false
        });
      })
    );


    it('should NOT create called element if property is deactivated', inject(
      function(elementRegistry, modeling) {

        // given
        const callActivity = elementRegistry.get('Templated');

        // when
        modeling.updateProperties(callActivity, {
          name: 'baz'
        });

        expect(getPropagation(callActivity)).to.be.null;
      })
    );


    it('should NOT affect non-templated call activities', inject(
      function(elementRegistry, modeling) {

        // given
        const callActivity = elementRegistry.get('NonTemplated');
        const initialPropagation = getPropagation(callActivity);

        // when
        modeling.updateProperties(callActivity, {
          name: 'foo'
        });

        // then
        expect(getPropagation(callActivity)).to.eql(initialPropagation);
      })
    );


    it('should NOT affect non-call-activity', inject(
      function(elementRegistry, modeling) {

        // given
        const task = elementRegistry.get('Task');

        // when
        modeling.updateProperties(task, {
          name: 'newName'
        });

        // then
        expect(getPropagation(task)).to.be.null;
      })
    );
  });
});


// helpers //////////

function getCalledElement(element) {
  return findExtension(element, 'zeebe:CalledElement');
}

function getPropagation(callActivity) {
  const calledElement = getCalledElement(callActivity);
  return calledElement ? {
    propagateAllChildVariables: calledElement.get('propagateAllChildVariables'),
    propagateAllParentVariables: calledElement.get('propagateAllParentVariables')
  } : null;
}
