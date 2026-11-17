// Ported from camunda/c8ctl@673214a1547c79167a18b25023924baf19a1be3c (MIT).
/**
 * Applies a migration to one element of a headless modeler.
 *
 * Each step is applied the way the library applies a template, with the
 * recipe's values forced on top: a clone of the step's template is
 * pre-seeded with the resolved values, applied, the values are written to
 * the extension tree, and the template is applied once more so bindings
 * whose condition the writes just satisfied materialise.
 */

import { bindingPath, bindingTargetKey, findExtensionContainers, findPropertiesByTarget, resolveBindingTarget, sameTarget } from './binding.js';
import { enumerateElementValues, getExtensionElements, unreadBindings } from './element-values.js';
import { getModdleNumber, getModdleString } from './moddle.js';
import { assertNoAmbiguousWrites, buildStepPlan, carryOverWrites, normalizeDestinationValue, validateDestinationValues, validateTargets } from './plan.js';
import { buildReport, hiddenIn, mergeFacts } from './report.js';
import { resolveApplications, resolveCatalog, resolveSteps } from './steps.js';

/**
 * The template an element is bound to, or `undefined` when it has none.
 * A version string is read like the moddle `Integer` type does, so a plain
 * object and a real element agree. An absent version reads as 0.
 */
export function readAppliedTemplate(businessObject) {
  const id = getModdleString(businessObject, 'modelerTemplate');
  if (id === undefined) {
    return undefined;
  }
  const asString = getModdleString(businessObject, 'modelerTemplateVersion');
  const version = asString !== undefined ? Number.parseInt(asString, 10) : getModdleNumber(businessObject, 'modelerTemplateVersion') ?? 0;
  return !Number.isSafeInteger(version) || version < 0 ? undefined : {
    id,
    version
  };
}

/** Move the original value at `from` to `to` on the final target. */

function availableNames(template) {
  return [ ...new Set(template.properties.filter(p => p.type !== 'Hidden' && p.binding).map(p => bindingPath(p.binding?.type, bindingTargetKey(p.binding) ?? ''))) ].join(', ');
}

/**
 * Resolve `maps` against the element's original values. Pure: throws before
 * anything is modified when a path is unbound or ambiguous. A map whose
 * source holds no value is skipped.
 */
function resolveMapWrites(maps, before, fromTemplate, target) {
  const result = {
    writes: [],
    moved: []
  };
  for (const map of maps) {
    const fromPath = bindingPath(map.from.bindingType, map.from.key);
    const toPath = bindingPath(map.to.bindingType, map.to.key);
    const label = `--map ${map.from.bindingType ? fromPath : map.from.key}=${map.to.bindingType ? toPath : map.to.key}`;
    if (fromTemplate.properties.length > 0 && findPropertiesByTarget(fromTemplate.properties, map.from.key, map.from.bindingType).length === 0) {
      throw new Error(`${label}: source "${map.from.key}" is not a binding in template ${fromTemplate.id}@${fromTemplate.version}. Available: ${availableNames(fromTemplate)}`);
    }
    const entry = {
      kind: 'set',
      to: map.to.bindingType ? toPath : map.to.key,
      value: '',
      when: [],
      label
    };
    const destinations = findPropertiesByTarget(target.properties, map.to.key, map.to.bindingType).filter(p => p.type !== 'Hidden');
    if (destinations.length === 0) {
      throw new Error(`${label}: destination "${map.to.key}" is not a settable binding in template ${target.id}@${target.version}. Available: ${availableNames(target)}`);
    }
    validateTargets([ entry ], target);
    const sources = before.filter(v => sameTarget(v, map.from));
    if (new Set(sources.map(v => v.bindingType)).size > 1) {
      throw new Error(`${label}: source "${map.from.key}" is bound by several binding types; add a prefix such as input: or header:`);
    }
    const source = sources[0];
    if (!source || source.value === '') continue;
    const bindingType = destinations[0].binding?.type ?? null;
    result.writes.push({
      key: map.to.key,
      bindingType,
      value: source.value,
      entry: {
        ...entry,
        value: source.value
      }
    });
    result.moved.push({
      from: {
        key: source.key,
        bindingType: source.bindingType
      },
      to: {
        key: map.to.key,
        bindingType
      },
      transformed: false,
      map: true
    });
  }
  return result;
}

/** Where one original value currently lives. */

/**
 * Moves each original value's places through one application and returns the
 * places an implicit step removed along with their last copy. A value
 * survives normalization only when it is wrapped as `=<value>`.
 */
function advanceLineage(lineage, moved, after, implicit, reset = []) {
  const lost = [];
  for (const entry of lineage) {
    if (entry.places.length === 0) continue;
    const previous = entry.places;
    const candidates = [ ...previous, ...moved.flatMap(m => previous.some(p => p.key === m.from.key && p.bindingType === m.from.bindingType) ? [ {
      key: m.to.key,
      bindingType: m.to.bindingType,
      value: m.value ?? ''
    } ] : []) ];
    const survivors = [];
    const gone = [];
    for (const place of candidates) {
      const now = after.find(a => a.key === place.key && a.bindingType === place.bindingType);
      if (now && (place.value === '' || now.value === place.value ||

      // A Hidden reset is a replacement, not normalization.
      now.value === `=${place.value}` && !reset.some(r => r.key === place.key && r.bindingType === place.bindingType && r.from === place.value))) {
        if (!survivors.some(s => s.key === now.key && s.bindingType === now.bindingType)) survivors.push({
          key: now.key,
          bindingType: now.bindingType,
          value: now.value
        });
      } else if (previous.includes(place)) {
        gone.push(place);
      }
    }
    entry.places = survivors;
    if (implicit && survivors.length === 0) {
      lost.push(...gone.map(p => ({
        ...p,
        bindingType: p.bindingType ?? '',
        isFeel: false
      })));
    }
  }
  return lost;
}
function valuesOf(element) {
  return enumerateElementValues(getExtensionElements(element.businessObject));
}
function applyApplication(modeler, catalog, element, application, mapWrites = [], unverifiedReads = false) {
  const {
    template,
    step
  } = application;
  const applied = readAppliedTemplate(element.businessObject);
  if (applied?.id === template.id && applied.version === (template.version ?? 0)) {
    return null;
  }
  const values = valuesOf(element);
  const clone = structuredClone(template);
  const {
    writes: recipeWrites,
    facts,
    activeProperties
  } = buildStepPlan(step?.entries ?? [], values, clone, unverifiedReads);
  assertNoAmbiguousWrites([ ...recipeWrites, ...mapWrites ]);
  const stepWrites = [ ...recipeWrites, ...mapWrites ];
  const writes = [ ...stepWrites, ...carryOverWrites(stepWrites, values, template) ];
  const active = mapWrites.length > 0 ? validateDestinationValues(stepWrites, values, clone) : activeProperties;

  // Seed the template so optional and empty targets materialise on apply.
  for (const w of writes) {
    for (const property of findPropertiesByTarget(clone.properties, w.key, w.bindingType)) {
      if (!active.has(property)) continue;
      property.value = normalizeDestinationValue(property, w.value);
    }
  }
  modeler.elementTemplates.set(catalog.map(t => t.id === clone.id && t.version === clone.version ? clone : t));
  let current = modeler.elementTemplates.applyTemplate(element, clone) ?? element;

  // Re-applying keeps existing values, so write each resolved value directly.
  const containers = findExtensionContainers(getExtensionElements(current.businessObject));
  for (const w of writes) {
    for (const property of findPropertiesByTarget(clone.properties, w.key, w.bindingType)) {
      if (!active.has(property)) continue;
      if (!property.binding) {
        continue;
      }
      const target = resolveBindingTarget(property.binding, containers);
      if (target) {
        modeler.modeling.updateModdleProperties(current, target.child, {
          [target.property]: normalizeDestinationValue(property, w.value)
        });
      }
    }
  }
  current = modeler.elementTemplates.applyTemplate(current, clone) ?? current;
  const after = valuesOf(current);

  // Hidden properties of this step's template reset values no write claims.
  const reset = values.filter(v => v.value !== '' && !stepWrites.some(w => sameTarget(v, w)) &&

  // An active editable property owns the field, so a Hidden duplicate
  // is a conditional alternative, not a reset.
  !findPropertiesByTarget(clone.properties, v.key, v.bindingType).some(property => property.type !== 'Hidden' && active.has(property)) && findPropertiesByTarget(clone.properties, v.key, v.bindingType).some(property => property.type === 'Hidden') && !after.some(a => sameTarget(a, v) && a.value === v.value)).map(({
    key,
    bindingType,
    value
  }) => ({
    key,
    bindingType,
    from: value
  }));
  const resolvedValue = (key, bindingType) => {
    const write = writes.find(w => w.key === key && w.bindingType === bindingType);
    const property = findPropertiesByTarget(clone.properties, key, bindingType).find(property => active.has(property));
    return write && property ? normalizeDestinationValue(property, write.value) : undefined;
  };
  return {
    element: current,
    activeTemplate: {
      ...clone,

      // Unconditional properties are always active. A conditional one counts only
      // when a write reached it, so an unknown condition never hides a loss.
      properties: clone.properties.filter(property => active.has(property) || !('condition' in property && property.condition))
    },
    facts: {
      ...facts,
      after,
      reset,
      moved: facts.moved.map(move => ({
        ...move,
        value: resolvedValue(move.to.key, move.to.bindingType)
      })),
      set: recipeWrites.filter(write => write.entry.kind === 'set' || write.entry.kind === 'template').map(write => ({
        key: write.key,
        bindingType: write.bindingType,
        value: resolvedValue(write.key, write.bindingType) ?? write.value
      }))
    }
  };
}

/**
 * Migrate `element` from the template it is on to `target`.
 *
 * `templates` must hold every template the change may need: the applied one
 * (for a precise carry-over), the intermediate versions a recipe climbs and
 * the target. `fromTemplate` is a stub with no properties when the applied
 * template is not available; pass `sourceKnown: false` then, so the recipe is
 * not checked against the stub. Throws when a required step template is missing
 * or the recipe writes to a path the target does not bind; nothing is
 * modified in that case.
 */
export function migrateElement({
  modeler,
  element,
  fromTemplate,
  sourceKnown = true,
  target,
  templates,
  recipe,
  engineVersion,
  isCompatible,
  maps = []
}) {
  const applied = readAppliedTemplate(element.businessObject);
  if (!applied || applied.id !== fromTemplate.id || applied.version !== (fromTemplate.version ?? 0)) {
    throw new Error("Migration context does not match the element's applied template.");
  }
  templates = resolveCatalog(templates, [ fromTemplate, target ]);
  const {
    steps,
    refusal
  } = resolveSteps({
    appliedId: fromTemplate.id,
    appliedVersion: fromTemplate.version ?? 0,
    appliedShapeKnown: sourceKnown,
    target,
    templates,
    recipe,
    engineVersion,
    isCompatible
  });
  const applications = resolveApplications(templates, steps, target);
  for (const {
    step,
    template
  } of applications) {
    if (step) {
      validateTargets(step.entries, template);
    }
  }
  const catalog = resolveCatalog([ fromTemplate, ...applications.map(a => a.template) ], [ fromTemplate, target ]);
  const before = valuesOf(element);

  // Without the source definition, unread values come from the element.
  const reportSource = fromTemplate.properties.length > 0 ? fromTemplate : {
    ...fromTemplate,
    properties: unreadBindings(element.businessObject).map(binding => ({
      binding
    }))
  };
  const mapPlan = resolveMapWrites(maps, before, fromTemplate, target);
  const allFacts = [];

  // An implicit step has no recipe, so an original value its template lacks is
  // lost even when a later template defaults the same binding. Each original
  // value is followed through every step, across moves and normalization.
  const lineage = before

  // A Hidden source value is template-managed, so a reset is no loss.
    .filter(v => v.value !== '' && !hiddenIn(fromTemplate, v, 'every')).map(v => ({
      places: [ {
        key: v.key,
        bindingType: v.bindingType,
        value: v.value
      } ]
    }));
  const lostInImplicitSteps = [];
  const implicitTemplates = [];
  let current = element;
  let mapsApplied = false;
  for (const [ index, application ] of applications.entries()) {
    const isFinal = index === applications.length - 1;
    const result = applyApplication(modeler, catalog, current, application, isFinal ? mapPlan.writes : [], index === 0 && !sourceKnown);
    if (result) {
      current = result.element;
      allFacts.push(result.facts);
      if (application.step?.implicit) implicitTemplates.push(result.activeTemplate);
      lostInImplicitSteps.push(...advanceLineage(lineage, result.facts.moved, valuesOf(current), application.step?.implicit === true, result.facts.reset));
      mapsApplied ||= isFinal;
    }
  }
  const finalApplied = readAppliedTemplate(current.businessObject);
  if (!finalApplied || finalApplied.id !== target.id || finalApplied.version !== (target.version ?? 0)) {
    throw new Error('Migration did not apply the target template identity.');
  }
  const facts = mergeFacts(allFacts);
  if (mapsApplied) {

    // Maps read the original values, so they bypass step-to-step chaining.
    facts.moved.push(...mapPlan.moved.map(move => {
      const property = findPropertiesByTarget(target.properties, move.to.key, move.to.bindingType)[0];
      const write = mapPlan.writes.find(w => sameTarget(w, move.to));
      return {
        ...move,
        value: property && write ? normalizeDestinationValue(property, write.value) : undefined
      };
    }));
  }
  const report = buildReport({
    fromTemplate: reportSource,
    toTemplate: target,
    via: applications.map(a => a.template),
    before,
    after: allFacts.at(-1)?.after ?? before,
    facts,
    usedRecipe: steps.length > 0,
    refusal,
    lostInImplicitSteps,
    implicitTemplates,
    steps: reportSteps(steps, fromTemplate.version ?? 0)
  });
  return {
    element: current,
    report
  };
}
function reportSteps(steps, appliedVersion) {
  let reached = appliedVersion;
  return steps.map(step => {
    const reportStep = {
      kind: step.kind,
      templateId: step.templateId,
      fromVersion: reached,
      toVersion: step.version,
      ...(step.implicit ? {
        implicit: true
      } : {})
    };
    if (step.kind === 'version') reached = step.version;
    return reportStep;
  });
}
