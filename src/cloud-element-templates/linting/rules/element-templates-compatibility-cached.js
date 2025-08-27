import { is } from 'bpmn-js/lib/util/ModelUtil';
import EventBus from 'diagram-js/lib/core/EventBus';

import ElementTemplates from '../../ElementTemplates';
import { GlobalCache, getCachedValidator, createTemplateKey } from '../cache/GlobalCache';

const DEBUG = false; // Set to false in production for performance

const debugLog = DEBUG ?
  console.log.bind(console, '[element-templates-compatibility]') :
  () => {};

const compatibilityCache = new GlobalCache('element-templates-compatibility', 2000, 500);

export default function({ templates = [] }) {
  const { validTemplates } = getCachedValidator(templates, debugLog);

  debugLog('Initialized with templates:', templates.length, 'valid:', validTemplates.length);

  const eventBus = new EventBus();
  const elementTemplates = new ElementTemplates(null, null, eventBus, null, null);

  elementTemplates.set(validTemplates);

  // Cache for update availability to avoid repeated calculations
  const updateAvailabilityCache = new Map();

  function isUpdateAvailable(template) {
    if (updateAvailabilityCache.has(template.id)) {
      return updateAvailabilityCache.get(template.id);
    }

    const latestTemplate = elementTemplates.getLatest(template.id, { deprecated: true })[0];
    const hasUpdate = latestTemplate && latestTemplate !== template;

    updateAvailabilityCache.set(template.id, hasUpdate);
    return hasUpdate;
  }

  function check(node, reporter) {
    if (is(node, 'bpmn:Definitions')) {
      elementTemplates.setEngines(getEnginesConfig(node));
      return; // Early exit after setting engines
    }

    if (!is(node, 'bpmn:FlowElement')) {
      return;
    }

    debugLog('Checking compatibility for node:', node.id, 'type:', node.$type);

    let template = elementTemplates.get(node);

    // Early exit if no template
    if (!template) {
      return;
    }

    // Early exit if template has no engines to check
    if (!template.engines) {
      debugLog('No engines to check for template:', template.id);
      return;
    }

    debugLog('Checking compatibility for template:', template.id, 'version:', template.version);

    // Create optimized cache key
    const templateHash = createTemplateKey(template);
    const cacheKey = [ node.id, templateHash ].join('_');

    if (compatibilityCache.has(cacheKey)) {
      const cachedErrors = compatibilityCache.get(cacheKey);
      debugLog('Compatibility cache hit for node:', node.id, 'returning', cachedErrors.length, 'cached errors');

      // Optimized error reporting
      for (let i = 0; i < cachedErrors.length; i++) {
        const error = cachedErrors[i];
        reporter.report(node.id, error.message, error.context);
      }
      return;
    }

    debugLog('Compatibility cache miss for node:', node.id, 'performing compatibility check');

    const errors = [];
    const incompatibleEngines = elementTemplates.getIncompatibleEngines(template);
    const engineNames = Object.keys(incompatibleEngines);

    // Early exit if no incompatible engines
    if (engineNames.length === 0) {
      debugLog('No incompatible engines found for template:', template.id);
      compatibilityCache.set(cacheKey, errors);
      return;
    }

    // Check if update is available once for this template
    const hasUpdate = isUpdateAvailable(template);

    // Process incompatible engines efficiently
    for (let i = 0; i < engineNames.length; i++) {
      const engine = engineNames[i];
      const incompatibility = incompatibleEngines[engine];

      debugLog('Found incompatible engine:', engine, 'for template:', template.id);

      const message = getIncompatibilityText(engine, incompatibility, hasUpdate);
      const errorData = {
        message,
        context: { name: node.name }
      };

      errors.push(errorData);
      reporter.report(node.id, message, errorData.context);
    }

    debugLog('Compatibility check completed for node:', node.id, 'found', errors.length, 'errors');

    // Cache the results
    compatibilityCache.set(cacheKey, errors);
  }

  return { check };
}

// helpers //////////////////////

function getEnginesConfig(definitions) {
  const engines = {};
  const executionPlatform = definitions.get('modeler:executionPlatform');
  const executionPlatformVersion = definitions.get('modeler:executionPlatformVersion');

  // Optimized string comparison
  if (executionPlatform === 'Camunda Cloud' && executionPlatformVersion) {
    engines.camunda = executionPlatformVersion;
  }

  return engines;
}

function getIncompatibilityText(engine, { actual, required }, updateAvailable) {
  const parts = [
    `Element template incompatible with current <${engine}> environment.`,
    `Requires '${engine} ${required}'; found '${actual}'.`
  ];

  if (updateAvailable) {
    parts.push('Update available.');
  }

  return parts.join(' ');
}