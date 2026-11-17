// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Context guards of migrateElement against a stub modeler
 * (default-plugins/element-template/migration/apply.ts)
 */

import { strict as assert } from 'assert';
import { migrateElement, readAppliedTemplate } from '../../../src/migration/apply.js';
import { parseRecipe } from '../../../src/migration/recipe.js';
import { resolveApplications } from '../../../src/migration/steps.js';
const SOURCE = {
  id: 'source',
  version: 1,
  properties: [ {
    binding: {
      type: 'zeebe:input',
      name: 'a'
    }
  } ]
};
const TARGET = {
  id: 'target',
  version: 2,
  properties: [ {
    binding: {
      type: 'zeebe:input',
      name: 'b'
    }
  } ]
};

/** The template registered for `identity`'s id and version, whatever the order. */
function registeredFor(ctx, identity) {
  return ctx.registered[0].find(template => template.id === identity.id && template.version === identity.version);
}
function context(applied = {
  modelerTemplate: SOURCE.id,
  modelerTemplateVersion: SOURCE.version
}) {
  const businessObject = {
    $type: 'bpmn:ServiceTask',
    ...applied,
    get(name) {
      return this[name];
    }
  };
  const element = {
    businessObject
  };
  const registered = [];
  const applications = [];
  const modeler = {
    elementTemplates: {
      set(templates) {
        registered.push(templates);
      },
      applyTemplate(current, template) {
        applications.push(template);
        current.businessObject.modelerTemplate = template.id;
        current.businessObject.modelerTemplateVersion = template.version;
        return current;
      }
    },
    modeling: {
      updateModdleProperties(_element, moddleElement, properties) {
        Object.assign(moddleElement, properties);
      }
    }
  };
  return {
    modeler,
    element,
    registered,
    applications
  };
}

describe('migration context consistency', function() {
  for (const [ name, fromTemplate, applied ] of [ [ 'source ID', {
    ...SOURCE,
    id: 'different'
  }, undefined ], [ 'source version', {
    ...SOURCE,
    version: 2
  }, undefined ], [ 'missing source version', {
    ...SOURCE,
    version: undefined
  }, undefined ], [ 'unbound element', SOURCE, {} ], [ 'missing applied version', SOURCE, {
    modelerTemplate: SOURCE.id
  } ], [ 'invalid applied version', SOURCE, {
    modelerTemplate: SOURCE.id,
    modelerTemplateVersion: -1
  } ] ]) {
    it(`rejects inconsistent ${name} before vendor mutation`, function() {
      const ctx = context(applied);
      const before = structuredClone({
        ...ctx.element.businessObject,
        get: undefined
      });
      assert.throws(() => migrateElement({
        ...ctx,
        fromTemplate,
        target: TARGET,
        templates: [ SOURCE, TARGET ]
      }), /applied template/);
      assert.deepEqual(ctx.registered, []);
      assert.deepEqual(ctx.applications, []);
      assert.deepEqual({
        ...ctx.element.businessObject,
        get: undefined
      }, before);
    });
  }
  for (const version of [ 0, '0', 1, '1', Number.MAX_SAFE_INTEGER ]) {
    it(`accepts matching numeric/string applied version ${JSON.stringify(version)}`, function() {
      const fromTemplate = {
        ...SOURCE,
        version: Number(version)
      };
      const ctx = context({
        modelerTemplate: SOURCE.id,
        modelerTemplateVersion: version
      });
      const {
        report,
        element
      } = migrateElement({
        ...ctx,
        fromTemplate,
        target: TARGET,
        templates: [ fromTemplate, TARGET ]
      });
      assert.equal(report.from.version, Number(version));
      assert.deepEqual(readAppliedTemplate(element.businessObject), {
        id: report.to.id,
        version: report.to.version
      });
    });
  }

  it('permits an unavailable-source stub and a target outside the catalog', function() {
    const ctx = context();
    const stub = {
      ...SOURCE,
      properties: []
    };
    const {
      report
    } = migrateElement({
      ...ctx,
      fromTemplate: stub,
      target: TARGET,
      templates: []
    });
    assert.equal(report.from.id, SOURCE.id);
    assert.equal(report.to.id, TARGET.id);
    assert.equal(registeredFor(ctx, stub), stub);
    assert.equal(ctx.applications[0].id, TARGET.id);
  });
  for (const reverse of [ false, true ]) {
    it(`supplied target wins over conflicting catalog identity (reverse=${reverse})`, function() {
      const shadow = {
        ...TARGET,
        name: 'catalog shadow',
        properties: []
      };
      const catalog = reverse ? [ shadow, SOURCE ] : [ SOURCE, shadow ];
      const applications = resolveApplications(catalog, [ {
        kind: 'hop',
        templateId: TARGET.id,
        version: TARGET.version ?? 0,
        entries: []
      } ], TARGET);
      assert.equal(applications[0].template, TARGET);
      const ctx = context();
      const {
        report
      } = migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target: TARGET,
        templates: catalog
      });
      assert.equal(report.to.name, TARGET.name);
      assert.deepEqual(ctx.applications[0].properties, TARGET.properties);
      assert.ok(ctx.registered[0].every(template => template.name !== shadow.name));
    });
  }
  for (const catalogSource of [ undefined, {
    ...SOURCE,
    properties: []
  } ]) {
    it(`uses the supplied source shape for coverage and registration (${catalogSource ? 'conflicting catalog' : 'absent catalog'})`, function() {
      const target = {
        ...TARGET,
        id: SOURCE.id,
        version: 2
      };
      const ctx = context();
      const {
        report
      } = migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target,
        templates: catalogSource ? [ catalogSource, target ] : [ target ],
        recipe: parseRecipe({
          schemaVersion: 1,
          sources: [ {
            kind: 'upgrade',
            sourceTemplateId: SOURCE.id,
            toVersion: 2,
            paths: [ {
              from: 'a',
              to: 'b'
            } ]
          } ]
        })
      });
      assert.equal(report.refusal, null);
      assert.equal(report.usedRecipe, true);
      assert.equal(registeredFor(ctx, SOURCE), SOURCE);
    });
  }
  for (const [ name, id, version ] of [ [ 'unchanged source', SOURCE.id, SOURCE.version ], [ 'wrong target ID', 'different', TARGET.version ], [ 'wrong target version', TARGET.id, 99 ], [ 'missing target version', TARGET.id, undefined ], [ 'invalid target version', TARGET.id, -1 ] ]) {
    it(`rejects a final applied identity inconsistent with its report (${name})`, function() {
      const ctx = context();
      ctx.modeler.elementTemplates.applyTemplate = element => {
        element.businessObject.modelerTemplate = id;
        element.businessObject.modelerTemplateVersion = version;
        return element;
      };
      assert.throws(() => migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target: TARGET,
        templates: [ SOURCE, TARGET ]
      }), {
        message: 'Migration did not apply the target template identity.'
      });
    });
  }
  const upgradeReadingA = () => parseRecipe({
    schemaVersion: 1,
    sources: [ {
      kind: 'upgrade',
      sourceTemplateId: SOURCE.id,
      toVersion: 2,
      paths: [ {
        from: 'a',
        to: 'b'
      } ]
    } ]
  });

  // The catalog shape lacks "a": borrowing it would refuse the recipe.
  const catalogWithoutA = {
    ...SOURCE,
    properties: [ {
      binding: {
        type: 'zeebe:input',
        name: 'b'
      }
    } ]
  };
  for (const catalogSource of [ undefined, catalogWithoutA ]) {
    it(`an unknown source skips coverage without borrowing it from the catalog (${catalogSource ? 'conflicting catalog' : 'absent catalog'})`, function() {
      const ctx = context();
      const fromTemplate = {
        ...SOURCE,
        properties: []
      };
      const target = {
        ...TARGET,
        id: SOURCE.id
      };
      const {
        report
      } = migrateElement({
        ...ctx,
        fromTemplate,
        sourceKnown: false,
        target,
        templates: catalogSource ? [ catalogSource, target ] : [ target ],
        recipe: upgradeReadingA()
      });
      assert.equal(report.refusal, null);
      assert.equal(report.usedRecipe, true);
      assert.equal(registeredFor(ctx, fromTemplate), fromTemplate);
    });
  }

  it('a known source without the read binding still refuses the recipe', function() {
    const ctx = context();
    const fromTemplate = {
      ...SOURCE,
      properties: []
    };
    const {
      report
    } = migrateElement({
      ...ctx,
      fromTemplate,
      target: {
        ...TARGET,
        id: SOURCE.id
      },
      templates: [],
      recipe: upgradeReadingA()
    });
    assert.match(report.refusal ?? '', /reads "a"/);
    assert.equal(report.usedRecipe, false);
  });
  for (const matches of [ false, true ]) {
    it(`checks the returned replacement element identity (matches=${matches})`, function() {
      const ctx = context();
      const replacement = context({
        modelerTemplate: matches ? TARGET.id : SOURCE.id,
        modelerTemplateVersion: matches ? TARGET.version : SOURCE.version
      }).element;
      ctx.modeler.elementTemplates.applyTemplate = () => replacement;
      const migrate = () => migrateElement({
        ...ctx,
        fromTemplate: SOURCE,
        target: TARGET,
        templates: [ SOURCE, TARGET ]
      });
      if (matches) assert.equal(migrate().element, replacement);else assert.throws(migrate, {
        message: 'Migration did not apply the target template identity.'
      });
    });
  }
});
