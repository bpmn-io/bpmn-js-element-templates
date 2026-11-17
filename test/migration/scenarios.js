import v1 from '../fixtures/migration/migration-v1.bpmn';
import v2 from '../fixtures/migration/migration-v2.bpmn';
import rest10 from '../fixtures/migration/templates/rest-v10.json';
import rest12 from '../fixtures/migration/templates/rest-v12.json';
import rest17 from '../fixtures/migration/templates/rest-v17.json';
import agent10 from '../fixtures/migration/templates/agent-v1-v10.json';
import agent11 from '../fixtures/migration/templates/agent-v1-v11.json';
import agent2 from '../fixtures/migration/templates/agent-v2-v1.json';
import { createTestModeler, loadVendorBundle } from './helper';
import { enumerateElementValues, getExtensionElements } from '../../src/migration/element-values';
import { readAppliedTemplate } from '../../src/migration/apply';
const templates = [ rest10, rest12, rest17, agent10, agent11, agent2 ];
const upgrade = {
  ...agent11,
  metadata: {
    migratesFrom: {
      schemaVersion: 1,
      sources: [ {
        kind: 'upgrade',
        sourceTemplateId: agent10.id,
        toVersion: 11,
        paths: [ { to: 'input:limits.timeout', set: 'PT30S' } ]
      } ]
    }
  }
};
const floorTarget = structuredClone(agent2);
floorTarget.metadata.migratesFrom.sources[0].minSourceVersion = 11;
export const scenarios = [ {
  name: 'REST 10 to 12',
  source: rest10,
  target: rest12
}, {
  name: 'REST 12 to 17',
  source: rest12,
  target: rest17
}, {
  name: 'REST 10 to 17',
  source: rest10,
  target: rest17
}, {
  name: 'REST already at 17',
  source: rest17,
  target: rest17
}, {
  name: 'Agent 10 to 11',
  source: agent10,
  target: agent11
}, {
  name: 'Agent 10 to v2',
  source: agent10,
  target: agent2
}, {
  name: 'Agent 11 to v2',
  source: agent11,
  target: agent2
}, {
  name: 'recipe refusal',
  source: rest17,
  target: agent2
}, {
  name: 'upgrade then hop',
  source: agent10,
  target: agent2,
  templates: templates.map(t => t === agent11 ? upgrade : t)
}, {
  name: 'compatible implicit floor',
  source: agent10,
  target: floorTarget,
  engineVersion: '8.10.0',
  isCompatible: template => template.version !== 10
}, {
  name: 'explicit map',
  source: rest10,
  target: agent2,
  maps: [ {
    from: {
      bindingType: 'zeebe:input',
      key: 'url'
    },
    to: {
      bindingType: 'zeebe:input',
      key: 'limits.timeout'
    }
  } ]
} ].flatMap(scenario => [ {
  ...scenario,
  expectation: scenario.name,
  name: `${scenario.name} (v1 BPMN)`,
  xml: v1,
  id: 'Task_Review'
}, {
  ...scenario,
  expectation: scenario.name,
  name: `${scenario.name} (v2 BPMN)`,
  xml: v2,
  id: 'Task_ReviewV2'
} ]);
export async function setupScenario(scenario) {
  const modeler = await createTestModeler(loadVendorBundle(), scenario.xml);
  const elementTemplates = modeler.get('elementTemplates');
  elementTemplates.set(templates);
  let element = modeler.get('elementRegistry').get(scenario.id);
  element = elementTemplates.applyTemplate(element, scenario.source) ?? element;
  const isRest = scenario.source.id === rest10.id;
  for (const [ name, value ] of Object.entries(isRest ? {
    'method': 'POST',
    'url': 'https://example.test/a?b=1&c=2',
    'authentication.type': 'bearer',
    'authentication.token': '=token',
    'keepBody': 'true'
  } : {
    'provider.type': 'alpha',
    'provider.alpha.model': 'custom-model',
    'limits.maxRounds': '7'
  })) {
    const property = scenario.source.properties.find(p => p.binding?.name === name);
    if (property) elementTemplates.setPropertyValue(element, property, value);
  }
  modeler.get('commandStack').clear();
  return {
    modeler,
    element,
    fromTemplate: scenario.source,
    target: scenario.target,
    templates: scenario.templates ?? templates,
    maps: scenario.maps,
    engineVersion: scenario.engineVersion,
    isCompatible: scenario.isCompatible
  };
}
export function snapshot(element, report) {
  return JSON.parse(JSON.stringify({
    type: element.businessObject.$type,
    applied: readAppliedTemplate(element.businessObject),
    values: enumerateElementValues(getExtensionElements(element.businessObject)),
    report
  }));
}
