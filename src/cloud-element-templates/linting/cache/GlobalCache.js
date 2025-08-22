/**
 * Global cache implementation for element template linting rules
 */
import BpmnModdle from 'bpmn-moddle';
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';
import { Validator } from '../../Validator';

export class GlobalCache {
  constructor(name, maxSize = 5000, cleanupThreshold = 500) {
    this.name = name;
    this.cache = new Map();
    this.cacheSize = 0;
    this.maxSize = maxSize;
    this.cleanupThreshold = cleanupThreshold;
  }

  static getValidationCacheKey(node, template, templateHash) {
    const baseComponents = [
      templateHash.substring(0, 16), // Truncate for performance
      template?.id || 'unknown-template',
      template?.version || '0',
      node.id,
      node.$type
    ];

    return baseComponents.join('::');
  }

  has(key) {
    return this.cache.has(key);
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.evictIfNeeded();
    this.cache.set(key, value);
    this.cacheSize++;
    this.debugLog(`Cached entry for key: ${key.substring(0, 50)}..., cache size: ${this.cacheSize}`);
  }

  evictIfNeeded() {
    if (this.cacheSize >= this.maxSize) {
      const entriesToRemove = Math.min(
        this.cleanupThreshold,
        this.cacheSize - (this.maxSize * 0.8)
      );
      const iterator = this.cache.keys();

      this.debugLog(`Cache size limit reached: ${this.cacheSize}, evicting oldest ${entriesToRemove} entries`);

      for (let i = 0; i < entriesToRemove; i++) {
        const key = iterator.next().value;
        if (key) {
          this.cache.delete(key);
          this.cacheSize--;
        }
      }

      this.debugLog(`Cache cleanup completed. New cache size: ${this.cacheSize}`);
    }
  }

  flush() {
    const oldSize = this.cacheSize;
    this.cache.clear();
    this.cacheSize = 0;
    this.debugLog(`Cache flushed. Cleared ${oldSize} entries`);
  }

  debugLog(message) {
    console.debug(`[${this.name}]`, message);
  }

  getSize() {
    return this.cacheSize;
  }

  clear() {
    this.cache.clear();
    this.cacheSize = 0;
    this.debugLog('Cache cleared');
  }
}

// Shared template parsing cache
export const parsedTemplatesCache = new Map();

export function createTemplateKey(template) {
  return JSON.stringify({
    id: template.id,
    version: template.version,
    content: typeof template === 'string' ? template : JSON.stringify(template)
  });
}

export function getCachedValidator(templates, debugLog) {
  const templateKeys = templates.map(createTemplateKey);
  const cacheKey = JSON.stringify(templateKeys);

  if (parsedTemplatesCache.has(cacheKey)) {
    debugLog('Using cached validator for', templates.length, 'templates');
    return parsedTemplatesCache.get(cacheKey);
  }

  debugLog('Creating new validator and parsing', templates.length, 'templates');

  const moddle = new BpmnModdle({ zeebe: zeebeModdle });
  const validator = new Validator(moddle).addAll(templates);
  const validTemplates = validator.getValidTemplates();

  const result = { validator, validTemplates };
  parsedTemplatesCache.set(cacheKey, result);

  // Prevent unbounded cache growth
  if (parsedTemplatesCache.size > 50) {
    const oldestKey = parsedTemplatesCache.keys().next().value;
    parsedTemplatesCache.delete(oldestKey);
    debugLog('Evicted oldest parsed templates from cache');
  }

  return result;
}