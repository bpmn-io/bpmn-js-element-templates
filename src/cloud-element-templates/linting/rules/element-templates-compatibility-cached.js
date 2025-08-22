/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

import { is } from 'bpmn-js/lib/util/ModelUtil';
import EventBus from 'diagram-js/lib/core/EventBus';

import ElementTemplates from '../../ElementTemplates';
import { GlobalCache, getCachedValidator, createTemplateKey } from '../cache/GlobalCache';

const DEBUG = true;

function debugLog(message, ...args) {
  if (DEBUG) {
    console.log('[element-templates-compatibility]', message, ...args);
  }
}

// Global compatibility cache
const compatibilityCache = new GlobalCache('element-templates-compatibility', 5000, 500);

export default function({ templates = [] }) {
  const { validTemplates } = getCachedValidator(templates, debugLog);

  debugLog('Initialized with templates:', templates.length, 'valid:', validTemplates.length);

  const eventBus = new EventBus();
  const elementTemplates = new ElementTemplates(null, null, eventBus, null, null);

  elementTemplates.set(validTemplates);

  function isUpdateAvailable(template) {
    const latestTemplate = elementTemplates.getLatest(template.id, { deprecated: true })[0];
    return latestTemplate && latestTemplate !== template;
  }

  function check(node, reporter) {
    if (is(node, 'bpmn:Definitions')) {
      elementTemplates.setEngines(getEnginesConfig(node));
    }

    if (!is(node, 'bpmn:FlowElement')) {
      return;
    }

    let template = elementTemplates.get(node);

    if (!template) {
      return;
    }

    // Create hash only for the specific template being used
    const templateHash = createTemplateKey(template);
    const cacheKey = GlobalCache.getValidationCacheKey(node, template, templateHash);

    if (compatibilityCache.has(cacheKey)) {
      const cachedErrors = compatibilityCache.get(cacheKey);
      debugLog('Compatibility cache hit for node:', node.id, 'returning', cachedErrors.length, 'cached errors');
      cachedErrors.forEach(error => {
        reporter.report(node.id, error.message, error.context);
      });
      return;
    }

    debugLog('Compatibility cache miss for node:', node.id, 'performing compatibility check');

    const errors = [];

    // Check compatibility
    if (template.engines) {
      const incomp = elementTemplates.getIncompatibleEngines(template);
      Object.keys(incomp).forEach((engine) => {
        const message = getIncompatibilityText(engine, incomp[engine], isUpdateAvailable(template));
        const errorData = {
          message,
          context: { name: node.name }
        };

        errors.push(errorData);
        reporter.report(node.id, message, errorData.context);
      });
    }

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

  if (executionPlatform === 'Camunda Cloud' && executionPlatformVersion) {
    engines.camunda = executionPlatformVersion;
  }

  return engines;
}

function getIncompatibilityText(engine, { actual, required }, updateAvailable) {
  const message =
    `Element template incompatible with current <${engine}> environment. ` +
    `Requires '${engine} ${required}'; found '${actual}'. ` +
    `${updateAvailable ? 'Update available.' : ''}`;

  return message.trim();
}