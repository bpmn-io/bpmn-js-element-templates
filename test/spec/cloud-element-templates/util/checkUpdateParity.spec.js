import { expect } from 'chai';

import coreModule from 'bpmn-js/lib/core';
import modelingModule from 'bpmn-js/lib/features/modeling';

import zeebeModdlePackage from 'zeebe-bpmn-moddle/resources/zeebe.json';

import {
  bootstrapModeler,
  getBpmnJS
} from 'test/TestHelper';

import elementTemplatesCoreModule from 'src/cloud-element-templates/core';

import { checkUpdate } from 'src/cloud-element-templates/util/checkUpdate';

import { isUserInput } from 'src/cloud-element-templates/util/carryOverUtil';

import {
  getPropertyValue,
  setPropertyValue
} from 'src/cloud-element-templates/util/propertyUtil';

const diagramXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const taskType = { type: 'zeebe:taskDefinition', property: 'type' };

const url = { type: 'zeebe:input', name: 'url' };
const endpoint = { type: 'zeebe:input', name: 'endpoint' };
const method = { type: 'zeebe:taskHeader', key: 'method' };

const methodDropdown = {
  label: 'Method',
  type: 'Dropdown',
  binding: method,
  choices: [
    { name: 'GET', value: 'GET' },
    { name: 'POST', value: 'POST' },
    { name: 'PUT', value: 'PUT' }
  ]
};

/**
 * Template changes, and the user input they keep, move or drop.
 */
const SCENARIOS = {
  'kept': [
    [ { label: 'URL', type: 'String', binding: url } ],
    [ { label: 'URL', type: 'String', binding: url } ]
  ],
  'dropped': [
    [ { label: 'URL', type: 'String', binding: url } ],
    [ { label: 'Endpoint', type: 'String', binding: endpoint } ]
  ],
  'moved': [
    [ { label: 'URL', type: 'String', binding: url } ],
    [ { label: 'Endpoint', type: 'String', binding: endpoint } ],
    [ { beforeVersion: 2, hints: [ { from: url, to: endpoint } ] } ]
  ],
  'Hidden': [
    [ { label: 'URL', type: 'String', binding: url } ],
    [ { type: 'Hidden', value: 'https://example.com', binding: url } ]
  ],
  'choices changed': [
    [ methodDropdown ],
    [ { ...methodDropdown, choices: [ { name: 'GET', value: 'get' }, { name: 'POST', value: 'POST' } ] } ]
  ],
  'choices mapped': [
    [ methodDropdown ],
    [ { ...methodDropdown, choices: [ { name: 'GET', value: 'get' }, { name: 'POST', value: 'post' } ] } ],
    [ { beforeVersion: 2, hints: [ { from: method, to: method, values: { GET: 'get', '*': 'post' } } ] } ]
  ],
  'choices mapped to invalid choice': [
    [ methodDropdown ],
    [ methodDropdown ],
    [ { beforeVersion: 2, hints: [ { from: method, to: method, values: { PUT: 'PATCH' } } ] } ]
  ],
  'text to choices': [
    [ { label: 'Method', type: 'String', binding: method } ],
    [ methodDropdown ]
  ],
  'task definition alias': [
    [ { label: 'Type', type: 'String', binding: { type: 'zeebe:taskDefinition:type' } } ],
    [ { label: 'Type', type: 'String', binding: taskType } ]
  ]
};


/**
 * Changes templates through the core, and verifies that `checkUpdate`
 * reports exactly the user input the core drops.
 */
describe('cloud-element-templates/util - checkUpdate (core parity)', function() {

  beforeEach(bootstrapModeler(diagramXML, {
    modules: [
      coreModule,
      elementTemplatesCoreModule,
      modelingModule
    ],
    moddleExtensions: {
      zeebe: zeebeModdlePackage
    }
  }));


  Object.entries(SCENARIOS).forEach(([ name, [ oldProperties, newProperties, updatePaths ] ]) => {

    it(name, function() {

      // given
      const oldTemplate = template(1, oldProperties);
      const newTemplate = template(2, newProperties, updatePaths);

      getBpmnJS().invoke(function(elementTemplates) {
        elementTemplates.set([ oldTemplate, newTemplate ]);
      });

      const findings = checkUpdate(oldTemplate, newTemplate);

      for (const property of oldTemplate.properties) {
        if (property.type === 'Hidden') {
          continue;
        }

        const values = property.choices
          ? property.choices.map(choice => choice.value)
          : [ 'user input' ];

        for (const value of values) {

          // when
          const kept = isKept(oldTemplate, newTemplate, property, value);

          // then
          const finding = findings.find(finding => {
            return finding.type === 'drop' &&
              finding.binding === property.binding &&
              (!property.choices || finding.value === value);
          });

          const message = `${ property.label } <${ value }>`;

          if (finding) {
            expect(kept, `${ message } is reported as dropped, but kept`).to.be.false;
          } else if (isUserInput(value, property)) {
            expect(kept, `${ message } is dropped, but not reported`).to.be.true;
          }
        }
      }
    });

  });

});


// helpers //////////

function template(version, properties, updatePaths) {
  return {
    id: 'example',
    name: 'Example',
    version,
    appliesTo: [ 'bpmn:Task' ],
    elementType: { value: 'bpmn:ServiceTask' },
    properties: [
      ...properties,
      ...(properties.some(property => property.binding.type.startsWith('zeebe:taskDefinition'))
        ? []
        : [ { type: 'Hidden', value: 'example', binding: taskType } ])
    ],
    updatePaths
  };
}

/**
 * Change an element with the given value from the old to the new template,
 * and check whether the value, or the value it maps to, is kept.
 */
function isKept(oldTemplate, newTemplate, property, value) {
  return getBpmnJS().invoke(function(bpmnFactory, canvas, commandStack, elementFactory, elementTemplates, modeling) {
    const shape = modeling.createShape(
      elementFactory.createShape({ type: 'bpmn:Task' }),
      { x: 100, y: 100 },
      canvas.getRootElement()
    );

    let element = elementTemplates.applyTemplate(shape, oldTemplate);

    setPropertyValue(bpmnFactory, commandStack, element, property, value);

    element = elementTemplates.applyTemplate(element, newTemplate);

    const expected = [ value, ...getMappedValues(newTemplate, value) ];

    return newTemplate.properties.some(newProperty => {
      return newProperty.type !== 'Hidden' &&
        expected.includes(getPropertyValue(element, newProperty));
    });
  });
}

function getMappedValues(template, value) {
  return (template.updatePaths || []).flatMap(({ hints = [] }) => {
    return hints.map(({ values = {} }) => values[ value ] || values[ '*' ]).filter(Boolean);
  });
}
