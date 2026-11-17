// Test adapter for the pinned c8ctl cases; browser and Node supply only the modeler constructor.
/**
 * Shared builders and seeding helpers for the element-template migration tests.
 */

import assert from 'assert';
import { getModdleElement, getModdleList } from '../../src/migration/moddle.js';

/** A String `zeebe:input` template property; `extra` overrides any field. */
export function input(name, value = '', extra = {}) {
  return {
    type: 'String',
    value,
    binding: {
      type: 'zeebe:input',
      name
    },
    ...extra
  };
}

/** Like `input`, labelled with its name. */
export function labelledInput(name, value = '', extra = {}) {
  return input(name, value, {
    label: name,
    ...extra
  });
}

/** A Task template with a Hidden type binding, optionally with an upgrade recipe. */
export function template(id, version, properties, sources) {
  return {
    id,
    name: id,
    version,
    appliesTo: [ 'bpmn:Task' ],
    engines: {
      camunda: '^8.8'
    },
    properties: [ {
      type: 'Hidden',
      value: id,
      binding: {
        type: 'zeebe:taskDefinition',
        property: 'type'
      }
    }, ...properties ],
    ...(sources ? {
      metadata: {
        migratesFrom: {
          schemaVersion: 1,
          sources
        }
      }
    } : {})
  };
}

/** A populated `zeebe:input` value as read from an element. */
export function elementValue(key, value) {
  return {
    bindingType: 'zeebe:input',
    key,
    value,
    isFeel: value.startsWith('=')
  };
}

/** One service task, `Task_1`, on Camunda 8.10. */
export const DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:modeler="http://camunda.org/schema/modeler/1.0" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.10.0">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:serviceTask id="Task_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="100" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** The modeler environment configured by the Node or browser test entry. */
export function loadVendorBundle() {
  return environment;
}

/** A headless modeler of the vendored bundle with `xml` imported. */
export async function createTestModeler(vendor, xml = DIAGRAM) {
  const modeler = new vendor.Modeler({
    additionalModules: [ vendor.HeadlessTextRendererModule, vendor.CloudElementTemplatesCoreModule ],
    moddleExtensions: {
      zeebe: vendor.ZeebeModdleExtension
    }
  });
  modelers.push(modeler);
  await modeler.importXML(xml);
  return modeler;
}

/** Apply `applied` to `Task_1` of `DIAGRAM` and set its input values. */
export async function setupAppliedModeler(vendor, applied, values) {
  const modeler = await createTestModeler(vendor);
  const elementTemplates = modeler.get('elementTemplates');
  const modeling = modeler.get('modeling');
  elementTemplates.set([ applied ]);
  const element = modeler.get('elementRegistry').get('Task_1');
  assert.ok(element);
  const seeded = elementTemplates.applyTemplate(element, applied) ?? element;
  for (const [ name, value ] of Object.entries(values)) {
    const ext = getModdleElement(seeded.businessObject, 'extensionElements');
    const io = getModdleList(ext, 'values').find(v => v.$type === 'zeebe:IoMapping');
    const param = getModdleList(io, 'inputParameters').find(p => p.target === name);
    assert.ok(param);
    modeling.updateModdleProperties(seeded, param, {
      source: value
    });
  }
  const migrationModeler = {
    elementTemplates,
    modeling
  };
  return {
    modeler,
    migrationModeler,
    element: seeded
  };
}
let environment;
const modelers = [];
export function configure(value) {
  environment = value;
}
export function cleanup() {
  for (const modeler of modelers.splice(0)) modeler.destroy();
}
