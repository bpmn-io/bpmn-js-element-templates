import assert from 'assert';
import { migrateElement } from '../../src/migration';
import { scenarios, setupScenario, snapshot } from './scenarios';
import { cleanup } from './helper';
import expected from '../fixtures/migration/expected.json';

function assertCatalogUnchanged(elementTemplates, templates, definitions) {
  const current = elementTemplates.getAll();

  assert.deepStrictEqual(current, definitions);
  assert.strictEqual(current.length, templates.length);
  current.forEach((template, index) => {
    assert.strictEqual(template, templates[index]);
  });
}

function captureTemplateInputs(options) {
  const inputs = {
    fromTemplate: options.fromTemplate,
    target: options.target,
    templates: options.templates
  };

  return {
    inputs,
    definitions: JSON.parse(JSON.stringify(inputs))
  };
}

function assertTemplateInputsUnchanged(options, inputs, definitions) {
  assert.strictEqual(options.fromTemplate, inputs.fromTemplate);
  assert.strictEqual(options.target, inputs.target);
  assert.strictEqual(options.templates, inputs.templates);
  assert.deepStrictEqual(JSON.parse(JSON.stringify({
    fromTemplate: options.fromTemplate,
    target: options.target,
    templates: options.templates
  })), definitions);
  assert.strictEqual(options.templates.find(template =>
    template.id === options.fromTemplate.id && template.version === options.fromTemplate.version
  ), options.fromTemplate);
  assert.strictEqual(options.templates.find(template =>
    template.id === options.target.id && template.version === options.target.version
  ), options.target);
}

describe('migration v0 - pinned c8ctl fixture parity', function() {
  afterEach(cleanup);

  for (const scenario of scenarios) {
    it(scenario.name, async function() {
      const options = await setupScenario(scenario);
      const {
        modeler
      } = options;
      const before = (await modeler.saveXML({
        format: true
      })).xml;
      let groups = 0;
      modeler.get('eventBus').on('commandStack.element-templates.multi-command-executor.preExecute', event => {
        if (event.context[0]?.cmd === 'element-templates.migrate') groups++;
      });
      const {
        element,
        report
      } = migrateElement(options);
      assert.deepStrictEqual(snapshot(element, report), expected[scenario.expectation]);
      assert.equal(groups, 1);
      modeler.get('commandStack').undo();
      assert.equal((await modeler.saveXML({
        format: true
      })).xml, before);
      modeler.get('commandStack').redo();
      assert.deepStrictEqual(snapshot(element, report), expected[scenario.expectation]);
    });
  }

  it('restores the shared catalog after success, undo, and redo', async function() {
    const scenario = scenarios.find(s => s.name === 'REST 10 to 17 (v2 BPMN)');
    const options = await setupScenario(scenario);
    const elementTemplates = options.modeler.get('elementTemplates');
    const unrelated = elementTemplates.getAll().find(template => template.id.includes('agent'));
    assert.ok(unrelated);
    const frozenUnrelated = Object.freeze(structuredClone(unrelated));
    elementTemplates.set(elementTemplates._templates.map(template =>
      template === unrelated ? frozenUnrelated : template
    ));
    const templates = elementTemplates.getAll();
    const definitions = JSON.parse(JSON.stringify(templates));
    const {
      inputs,
      definitions: inputDefinitions
    } = captureTemplateInputs(options);

    migrateElement(options);

    assertCatalogUnchanged(elementTemplates, templates, definitions);
    assertTemplateInputsUnchanged(options, inputs, inputDefinitions);

    const stack = options.modeler.get('commandStack');
    stack.undo();
    assertCatalogUnchanged(elementTemplates, templates, definitions);
    assertTemplateInputsUnchanged(options, inputs, inputDefinitions);

    stack.redo();
    assertCatalogUnchanged(elementTemplates, templates, definitions);
    assertTemplateInputsUnchanged(options, inputs, inputDefinitions);
    assert.ok(Object.isFrozen(frozenUnrelated));
  });

  it('does not leak seeded values into a subsequent element application', async function() {
    const scenario = scenarios.find(s => s.name === 'REST 10 to 17 (v2 BPMN)');
    const options = await setupScenario(scenario);
    const {
      modeler
    } = options;
    const elementTemplates = modeler.get('elementTemplates');
    const templates = elementTemplates.getAll();
    const definitions = JSON.parse(JSON.stringify(templates));
    const {
      inputs,
      definitions: inputDefinitions
    } = captureTemplateInputs(options);
    const firstUrl = 'https://example.test/a?b=1&c=2';
    const firstToken = '=token';

    migrateElement(options);
    assertTemplateInputsUnchanged(options, inputs, inputDefinitions);

    const second = modeler.get('elementRegistry').get('Task_Approve');
    const target = elementTemplates.get(options.target.id, options.target.version);
    const applied = elementTemplates.applyTemplate(second, target) ?? second;
    const appliedValues = snapshot(applied, null).values;
    assert.ok(!appliedValues.some(value => value.key === 'url' && value.value === firstUrl));
    assert.ok(!appliedValues.some(value => value.key === 'authentication.token' && value.value === firstToken));

    const stack = modeler.get('commandStack');
    stack.undo();
    let secondElement = elementTemplates.applyTemplate(second, options.fromTemplate) ?? second;
    for (const [ name, value ] of Object.entries({
      method: 'PUT',
      url: 'https://example.test/second?b=2',
      'authentication.type': 'bearer',
      'authentication.token': '=secondToken',
      keepBody: 'false'
    })) {
      const property = options.fromTemplate.properties.find(p => p.binding?.name === name);
      assert.ok(property, `expected source template property ${name}`);
      elementTemplates.setPropertyValue(secondElement, property, value);
    }
    stack.clear();

    const result = migrateElement({
      ...options,
      element: secondElement
    });
    const values = snapshot(result.element, result.report).values;
    assert.equal(values.find(value => value.key === 'url').value, 'https://example.test/second?b=2');
    assert.equal(values.find(value => value.key === 'authentication.token').value, '=secondToken');
    assertCatalogUnchanged(elementTemplates, templates, definitions);
    assertTemplateInputsUnchanged(options, inputs, inputDefinitions);
  });

  it('rolls back diagram changes when catalog restoration fails', async function() {
    const options = await setupScenario(scenarios.find(s => s.name === 'REST 10 to 17 (v2 BPMN)'));
    const {
      modeler
    } = options;
    const elementTemplates = modeler.get('elementTemplates');
    const catalog = elementTemplates.getAll();
    const definitions = JSON.parse(JSON.stringify(catalog));
    const originalCatalog = elementTemplates._templates;
    const originalSet = elementTemplates.set;
    const before = (await modeler.saveXML({ format: true })).xml;
    const failure = new Error('injected catalog restoration failure');
    elementTemplates.set = function(templates) {
      const result = originalSet.call(this, templates);
      if (templates === originalCatalog) throw failure;
      return result;
    };

    try {
      assert.throws(() => migrateElement(options), error => error === failure);
    } finally {
      elementTemplates.set = originalSet;
    }

    assert.equal((await modeler.saveXML({ format: true })).xml, before);
    assertCatalogUnchanged(elementTemplates, catalog, definitions);
    assert.equal(modeler.get('commandStack').canUndo(), false);
    assert.equal(modeler.get('commandStack').canRedo(), false);
  });

  for (const phase of [ 'before', 'after' ]) {
    it(`rolls back an injected ${phase}-write failure and keeps the stack usable`, async function() {
      const options = await setupScenario(scenarios.find(s => s.name === 'Agent 10 to v2 (v2 BPMN)'));
      const {
        modeler
      } = options;
      const stack = modeler.get('commandStack');
      const modeling = modeler.get('modeling');
      const elementTemplates = modeler.get('elementTemplates');
      const catalog = elementTemplates.getAll();
      const definitions = JSON.parse(JSON.stringify(catalog));
      const {
        inputs,
        definitions: inputDefinitions
      } = captureTemplateInputs(options);

      // Include existing undo AND redo history in the failure checkpoint.
      modeling.updateProperties(options.element, {
        name: 'kept edit'
      });
      modeling.updateProperties(options.element, {
        name: 'redo edit'
      });
      stack.undo();
      const before = (await modeler.saveXML({
        format: true
      })).xml;
      const update = modeling.updateModdleProperties;
      const failure = new Error('injected mid-apply failure');
      let calls = 0;
      modeling.updateModdleProperties = function(...args) {
        calls++;
        if (phase === 'before' && calls === 3) throw failure;
        const result = update.apply(this, args);
        if (phase === 'after' && calls === 3) throw failure;
        return result;
      };
      try {
        assert.throws(() => migrateElement(options), error => error === failure);
      } finally {
        modeling.updateModdleProperties = update;
      }
      assert.ok(calls >= 3, 'failure must occur after partial application');
      assert.equal((await modeler.saveXML({
        format: true
      })).xml, before);
      assertCatalogUnchanged(elementTemplates, catalog, definitions);
      assertTemplateInputsUnchanged(options, inputs, inputDefinitions);
      assert.ok(stack.canUndo());
      assert.ok(stack.canRedo());
      stack.redo();
      assert.equal(options.element.businessObject.name, 'redo edit');
      stack.undo();
      stack.undo();
      assert.notEqual(options.element.businessObject.name, 'kept edit');

      // No stale execution/atomic state may poison subsequent migrations.
      const result = migrateElement(options);
      assert.deepStrictEqual(snapshot(result.element, result.report), expected['Agent 10 to v2']);
      assertCatalogUnchanged(elementTemplates, catalog, definitions);
      assertTemplateInputsUnchanged(options, inputs, inputDefinitions);
    });
  }

  it('accepts equivalent intermediate JSON definitions regardless of member order', async function() {
    const scenario = scenarios.find(s => s.name === 'upgrade then hop (v1 BPMN)');
    const options = await setupScenario(scenario);
    const intermediate = options.templates.find(t => t.id === options.fromTemplate.id && t.version === 11);
    const reordered = Object.fromEntries(Object.entries(intermediate).reverse());
    const result = migrateElement({
      ...options,
      templates: [ ...options.templates, reordered ]
    });

    assert.deepStrictEqual(snapshot(result.element, result.report), expected[scenario.expectation]);
  });

  it('rolls back completed intermediate steps when the final application fails', async function() {
    const options = await setupScenario(scenarios.find(s => s.name === 'upgrade then hop (v1 BPMN)'));
    const { modeler } = options;
    const elementTemplates = modeler.get('elementTemplates');
    const before = (await modeler.saveXML({ format: true })).xml;
    const apply = elementTemplates.applyTemplate;
    const failure = new Error('injected final-step failure');
    let applications = 0;
    elementTemplates.applyTemplate = function(...args) {
      const result = apply.apply(this, args);
      if (++applications === 3) throw failure;
      return result;
    };
    try {
      assert.throws(() => migrateElement(options), error => error === failure);
    } finally {
      elementTemplates.applyTemplate = apply;
    }
    assert.equal(applications, 3);
    assert.equal((await modeler.saveXML({ format: true })).xml, before);
    assert.equal(modeler.get('elementRegistry').get(options.element.id), options.element);
    assert.equal(modeler.get('commandStack').canUndo(), false);
    assert.equal(modeler.get('commandStack').canRedo(), false);
  });

  it('rolls back a shape replacement before surfacing its application failure', async function() {
    const options = await setupScenario(scenarios.find(s => s.name === 'Agent 10 to v2 (v1 BPMN)'));
    options.target = { ...options.target, elementType: { value: 'bpmn:SendTask' } };
    const { modeler } = options;
    const elementTemplates = modeler.get('elementTemplates');
    const before = (await modeler.saveXML({ format: true })).xml;
    const apply = elementTemplates.applyTemplate;
    const failure = new Error('injected post-replacement failure');
    elementTemplates.applyTemplate = function(...args) {
      const result = apply.apply(this, args);
      assert.equal(result.businessObject.$type, 'bpmn:SendTask');
      throw failure;
    };
    try {
      assert.throws(() => migrateElement(options), error => error === failure);
    } finally {
      elementTemplates.applyTemplate = apply;
    }
    assert.equal((await modeler.saveXML({ format: true })).xml, before);
    assert.equal(modeler.get('elementRegistry').get(options.element.id), options.element);
    assert.equal(modeler.get('commandStack').canUndo(), false);
  });

  it('keeps the pinned compatibility-floor rejection and leaves the diagram unchanged', async function() {
    const options = await setupScenario(scenarios.find(s => s.name === 'compatible implicit floor (v1 BPMN)'));
    const before = (await options.modeler.saveXML({ format: true })).xml;
    assert.throws(() => migrateElement({
      ...options,
      engineVersion: '8.8.0',
      isCompatible: () => false
    }), /no version compatible with Camunda 8\.8\.0/);
    assert.equal((await options.modeler.saveXML({ format: true })).xml, before);
    assert.equal(options.modeler.get('commandStack').canUndo(), false);
  });
});
