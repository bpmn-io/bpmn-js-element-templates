// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * MIG-004, engine half: the supplied source and target beat the catalog
 * (default-plugins/element-template/migration/apply.ts)
 */

import { strict as assert } from 'assert';
import { migrateElement } from '../../../src/migration/apply.js';
const SOURCE = {
  id: 'source',
  version: 1,
  name: 'Authoritative source',
  properties: []
};
const TARGET = {
  id: 'target',
  version: 2,
  properties: [],
  metadata: {
    migratesFrom: {
      schemaVersion: 1,
      sources: [ {
        kind: 'change',
        sourceTemplateId: SOURCE.id
      } ]
    }
  }
};
const INVALID_METADATA = {
  migratesFrom: {
    schemaVersion: 99,
    sources: []
  }
};
function context() {
  const element = {
    businessObject: {
      $type: 'bpmn:Task',
      modelerTemplate: SOURCE.id,
      modelerTemplateVersion: SOURCE.version,
      get(name) {
        return this[name];
      }
    }
  };
  const registered = [];
  const applied = [];
  const modeler = {
    elementTemplates: {
      set(templates) {
        registered.push(templates);
      },
      applyTemplate(current, template) {
        applied.push(template);
        current.businessObject.modelerTemplate = template.id;
        current.businessObject.modelerTemplateVersion = template.version;
        return current;
      }
    },
    modeling: {
      updateModdleProperties(_element, moddle, properties) {
        Object.assign(moddle, properties);
      }
    }
  };
  return {
    modeler,
    element,
    registered,
    applied
  };
}

describe('migration catalog authority across recipe selection and registration', function() {
  it('conflicting intermediate identities cannot change coverage with catalog order', function() {
    const fromTemplate = {
      ...SOURCE,
      properties: [ {
        binding: {
          type: 'zeebe:input',
          name: 'a'
        }
      } ]
    };
    const intermediate = {
      ...SOURCE,
      version: 2,
      properties: [ {
        binding: {
          type: 'zeebe:input',
          name: 'b'
        }
      } ]
    };
    const shadow = {
      ...intermediate,
      properties: [ {
        binding: {
          type: 'zeebe:input',
          name: 'stale'
        }
      } ]
    };
    const latest = {
      ...SOURCE,
      version: 3,
      properties: [ {
        binding: {
          type: 'zeebe:input',
          name: 'c'
        }
      } ],
      metadata: {
        migratesFrom: {
          schemaVersion: 1,
          sources: [ {
            kind: 'upgrade',
            sourceTemplateId: SOURCE.id,
            toVersion: 2,
            paths: [ {
              from: 'a',
              to: 'b'
            } ]
          }, {
            kind: 'upgrade',
            sourceTemplateId: SOURCE.id,
            toVersion: 3,
            paths: [ {
              from: 'b',
              to: 'c'
            } ]
          } ]
        }
      }
    };
    const outcomes = [];
    for (const duplicates of [ [ intermediate, shadow ], [ shadow, intermediate ] ]) {
      const ctx = context();
      assert.throws(() => migrateElement({
        ...ctx,
        fromTemplate,
        target: TARGET,
        templates: [ fromTemplate, ...duplicates, latest, TARGET ]
      }), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Conflicting.*source.*version 2/);
        outcomes.push(error.message);
        return true;
      });
      assert.deepEqual(ctx.registered, []);
      assert.deepEqual(ctx.applied, []);
      assert.equal(ctx.element.businessObject.modelerTemplate, SOURCE.id);
      assert.equal(ctx.element.businessObject.modelerTemplateVersion, SOURCE.version);
    }
    assert.deepEqual(outcomes[0], outcomes[1]);
  });
  for (const reverse of [ false, true ]) {
    it(`supplied target overrides valid and invalid catalog shadows (reverse=${reverse})`, function() {
      const shadows = [ {
        ...TARGET,
        name: 'Stale target',
        properties: [ {
          binding: {
            type: 'zeebe:input',
            name: 'stale'
          }
        } ]
      }, {
        ...TARGET,
        metadata: INVALID_METADATA
      } ];
      const templates = [ SOURCE, ...(reverse ? shadows.toReversed() : shadows) ];
      const ctx = context();
      const {
        report
      } = migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target: TARGET,
        templates
      });
      assert.equal(report.refusal, null);
      assert.equal(report.usedRecipe, true);
      for (const template of ctx.applied) assert.deepEqual(template, TARGET);
      assert.ok(ctx.registered.flat().every(template => !shadows.includes(template)));
    });
    it(`accepts identical intermediate references and content (reverse=${reverse})`, function() {
      const intermediate = {
        ...SOURCE,
        version: 2
      };
      const latest = {
        ...SOURCE,
        version: 3,
        metadata: {
          migratesFrom: {
            schemaVersion: 1,
            sources: [ {
              kind: 'upgrade',
              sourceTemplateId: SOURCE.id,
              toVersion: 2
            }, {
              kind: 'upgrade',
              sourceTemplateId: SOURCE.id,
              toVersion: 3
            } ]
          }
        }
      };
      const duplicates = [ intermediate, intermediate, structuredClone(intermediate) ];
      const ctx = context();
      const {
        report
      } = migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target: TARGET,
        templates: [ ...(reverse ? duplicates.toReversed() : duplicates), latest ]
      });
      assert.equal(report.refusal, null);
      assert.equal(report.usedRecipe, true);
      for (const catalog of ctx.registered) {
        assert.equal(catalog.filter(template => template.id === SOURCE.id && template.version === 2).length, 1);
      }
    });
    it(`ignores an invalid shadow of the supplied source (reverse=${reverse})`, function() {
      const shadow = {
        ...SOURCE,
        name: 'Catalog source shadow',
        metadata: INVALID_METADATA
      };
      const templates = reverse ? [ TARGET, shadow ] : [ shadow, TARGET ];
      const ctx = context();
      const {
        report
      } = migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target: TARGET,
        templates
      });
      assert.equal(report.refusal, null);
      assert.equal(report.usedRecipe, true);
      assert.equal(report.from.name, SOURCE.name);
      assert.equal(ctx.registered[0][0], SOURCE);
      assert.ok(ctx.registered.flat().every(template => template !== shadow));
      assert.ok(ctx.applied.every(template => template.id === TARGET.id));
      assert.equal(shadow.metadata.migratesFrom.schemaVersion, 99);
    });
    it(`rejects invalid authoritative source metadata despite a valid shadow (reverse=${reverse})`, function() {
      const fromTemplate = {
        ...SOURCE,
        metadata: INVALID_METADATA
      };
      const templates = reverse ? [ TARGET, SOURCE ] : [ SOURCE, TARGET ];
      const ctx = context();
      assert.throws(() => migrateElement({
        ...ctx,
        fromTemplate,
        target: TARGET,
        templates
      }), /schemaVersion/);
      assert.deepEqual(ctx.registered, []);
      assert.deepEqual(ctx.applied, []);
      assert.equal(ctx.element.businessObject.modelerTemplate, SOURCE.id);
      assert.equal(ctx.element.businessObject.modelerTemplateVersion, SOURCE.version);
    });
  }
});
