import TestContainer from 'mocha-test-container-support';

import { expect } from 'chai';

import {
  bootstrapModeler,
  inject
} from 'test/TestHelper';

import coreModule from 'bpmn-js/lib/core';
import elementTemplatesCoreModule from 'src/cloud-element-templates/core';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe.json';

import diagramXML from './ElementTemplates.bpmn';


describe('provider/cloud-element-templates - ElementTemplates API', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  beforeEach(bootstrapModeler(diagramXML, {
    container,
    modules: [
      coreModule,
      elementTemplatesCoreModule,
      modelingModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    }
  }));


  it('should get property value', inject(function(elementRegistry, elementTemplates) {

    // given
    const task = elementRegistry.get('Task_1');
    const property = {
      type: 'String',
      binding: {
        type: 'property',
        name: 'name'
      }
    };

    // when
    const value = elementTemplates.getPropertyValue(task, property);

    // then
    expect(value).to.equal('foo');
  }));


  it('should set property value', inject(function(elementRegistry, elementTemplates) {

    // given
    const task = elementRegistry.get('Task_3');
    const property = {
      type: 'String',
      feel: 'required',
      binding: {
        type: 'zeebe:input',
        name: 'result'
      }
    };

    // when
    elementTemplates.setPropertyValue(task, property, 'response.body');

    // then
    expect(elementTemplates.getPropertyValue(task, property)).to.equal('=response.body');
  }));


  it('should remove empty optional Boolean property', inject(function(elementRegistry, elementTemplates) {

    // given
    const task = elementRegistry.get('Task_3');
    const property = {
      type: 'Boolean',
      feel: 'optional',
      optional: true,
      binding: {
        type: 'zeebe:input',
        name: 'enabled'
      }
    };

    elementTemplates.setPropertyValue(task, property, true);

    // assume
    expect(elementTemplates.getPropertyValue(task, property)).to.equal('=true');

    // when
    elementTemplates.setPropertyValue(task, property, undefined);

    // then
    expect(elementTemplates.getPropertyValue(task, property)).to.equal('');
  }));


  it('should remove empty optional Number property', inject(function(elementRegistry, elementTemplates) {

    // given
    const task = elementRegistry.get('Task_3');
    const property = {
      type: 'Number',
      feel: 'optional',
      optional: true,
      binding: {
        type: 'zeebe:input',
        name: 'retries'
      }
    };

    elementTemplates.setPropertyValue(task, property, 3);

    // assume
    expect(elementTemplates.getPropertyValue(task, property)).to.equal('=3');

    // when
    elementTemplates.setPropertyValue(task, property, '');

    // then
    expect(elementTemplates.getPropertyValue(task, property)).to.equal('');
  }));


  it('should validate property value', inject(function(elementTemplates) {

    // given
    const property = {
      type: 'String',
      constraints: {
        notEmpty: true
      }
    };

    // when
    const error = elementTemplates.validateProperty('', property);

    // then
    expect(error).to.equal('Must not be empty.');
  }));


  it('should validate normalized FEEL value', inject(function(elementTemplates) {

    // given
    const property = {
      type: 'String',
      feel: 'required',
      binding: {
        type: 'zeebe:input',
        name: 'result'
      },
      constraints: {
        minLength: 100
      }
    };

    // when
    const error = elementTemplates.validateProperty('response.body', property);

    // then
    expect(error).not.to.exist;
  }));


  it('should check property condition', inject(function(elementRegistry, elementTemplates) {

    // given
    const task = elementRegistry.get('Task_1');
    const properties = [
      {
        id: 'name',
        type: 'String',
        binding: {
          type: 'property',
          name: 'name'
        }
      },
      {
        id: 'conditional',
        type: 'String',
        binding: {
          type: 'property',
          name: 'id'
        },
        condition: {
          property: 'name',
          equals: 'foo'
        }
      }
    ];

    // when
    const conditionMet = elementTemplates.isConditionMet(task, properties, properties[1]);

    // then
    expect(conditionMet).to.be.true;
  }));

});