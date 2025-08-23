import { is } from 'bpmn-js/lib/util/ModelUtil';
import EventBus from 'diagram-js/lib/core/EventBus';

import ElementTemplates from '../../ElementTemplates';
import { getPropertyValue, validateProperty } from '../../util/propertyUtil';
import { applyConditions } from '../../Condition';
import { GlobalCache, getCachedValidator, createTemplateKey, createPropertyValuesHash } from '../cache/GlobalCache';

const DEBUG = false; // Set to false in production for performance

// Optimized debug logging - no-op when DEBUG is false
const debugLog = DEBUG ?
  console.log.bind(console, '[element-templates-validate]') :
  () => {};

// Global validation cache
const validationCache = new GlobalCache('element-templates-validate', 5000, 500);

export default function({ templates = [] }) {

  const { validTemplates } = getCachedValidator(templates, debugLog);

  debugLog('Initialized with templates:', templates.length, 'valid:', validTemplates.length);

  const eventBus = new EventBus();
  const elementTemplates = new ElementTemplates(null, null, eventBus, null, null);

  elementTemplates.set(validTemplates);

  function check(node, reporter) {
    if (!is(node, 'bpmn:FlowElement')) {
      return;
    }

    debugLog('Checking node:', node.id, 'type:', node.$type);

    const templateId = elementTemplates._getTemplateId(node);
    if (!templateId) {
      return;
    }

    let template = elementTemplates.get(node);
    if (!template) {
      debugLog('Template not found for node:', node.id, 'templateId:', templateId);
      reporter.report(node.id, 'Linked element template not found', { name: node.name });
      return;
    }

    debugLog('Using template:', template.id, 'version:', template.version, 'for node:', node.id);

    template = applyConditions(node, template);

    if (template.properties?.length === 0) {
      return;
    }

    // Cache property values to avoid multiple getPropertyValue calls
    const propertyValuesWithCache = template.properties.map(prop => {
      const value = getPropertyValue(node, prop);
      return { id: prop.id, value, property: prop };
    });

    // Create optimized cache key using shared utility
    const templateHash = createTemplateKey(template);
    const propertyHash = createPropertyValuesHash(propertyValuesWithCache);
    const cacheKey = [ node.id, templateHash, propertyHash ].join('_');

    if (validationCache.has(cacheKey)) {
      const cachedErrors = validationCache.get(cacheKey);
      debugLog('Global validation cache hit for node:', node.id, 'returning', cachedErrors.length, 'cached errors');

      for (let i = 0; i < cachedErrors.length; i++) {
        const error = cachedErrors[i];
        reporter.report(node.id, error.message, error.context);
      }

      return;
    }

    debugLog('Global validation cache miss for node:', node.id, 'performing validation');

    const errors = [];

    // Pre-compute entry IDs for better performance
    const entryIdMap = new Map();
    let groupPropertyCounts = {};

    // Single pass to build group counts and entry IDs
    for (let i = 0; i < template.properties.length; i++) {
      const property = template.properties[i];
      const group = property.group || '';

      if (!groupPropertyCounts[group]) {
        groupPropertyCounts[group] = 0;
      }

      const path = [ 'custom-entry', template.id ];
      if (property.group) {
        path.push(property.group);
      }
      path.push(groupPropertyCounts[group]);

      entryIdMap.set(property, path.join('-'));
      groupPropertyCounts[group]++;
    }

    for (let i = 0; i < propertyValuesWithCache.length; i++) {
      const { value, property } = propertyValuesWithCache[i];
      const error = validateProperty(value, property);

      if (error) {
        debugLog('Validation error for property:', property.binding?.name || property.id, 'error:', error);
        const errorData = {
          message: error,
          context: {
            propertiesPanel: {
              entryIds: [ entryIdMap.get(property) ]
            },
            name: node.name
          }
        };

        errors.push(errorData);
        reporter.report(node.id, error, errorData.context);
      }
    }

    debugLog('Validation completed for node:', node.id, 'found', errors.length, 'errors');

    // Cache the results globally
    validationCache.set(cacheKey, errors);
  }

  return {
    check
  };
}