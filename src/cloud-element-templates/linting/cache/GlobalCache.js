const DEBUG = false; // Set to false in production for performance

/**
 * GlobalCache class for caching with passive memory monitoring and eviction policies.
 * Designed to be library-friendly with no background processes.
 * All maintenance happens during active usage.
 */
export class GlobalCache {

  /**
   * Creates a new GlobalCache instance.
   * @param name - Name of the cache instance for logging
   * @param maxSize - Maximum number of entries in the cache
   * @param cleanupThreshold - Threshold to trigger cleanup before reaching maxSize
   */
  constructor(name, maxSize = 5000, cleanupThreshold = 500) {
    this.name = name;
    this.cache = new Map();
    this.maxSize = maxSize;
    this.cleanupThreshold = Math.min(cleanupThreshold, maxSize); // Ensure threshold <= maxSize

    // Track last maintenance check for passive monitoring
    this.lastMaintenanceCheck = Date.now();
  }

  has(key) {
    try {
      return this.cache.has(key);
    } catch (error) {
      this.debugLog('Error checking cache key:', error.message);
      return false;
    }
  }

  get(key) {
    try {
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      return undefined;
    } catch (error) {
      this.debugLog('Error retrieving cache value:', error.message);
      return undefined;
    }
  }

  set(key, value) {
    try {
      const hadKey = this.cache.has(key);

      if (!hadKey) {
        this.evictIfNeeded();

        // Passive maintenance check - only during active usage
        this.checkMaintenanceIfNeeded();
      }

      this.cache.set(key, value);

      if (!hadKey) {
        this.debugLog(`Cached new entry: ${key.substring(0, 50)}..., size: ${this.cache.size}`);
      }
    } catch (error) {
      this.debugLog('Error setting cache value:', error.message);
    }
  }

  checkMaintenanceIfNeeded() {
    const now = Date.now();

    // Only check every 60 seconds during active usage
    if (now - this.lastMaintenanceCheck > 60000) {
      this.performMaintenance();
      this.lastMaintenanceCheck = now;
    }
  }

  evictIfNeeded() {
    const currentSize = this.cache.size;

    // Implement threshold-based cleanup for better performance
    if (currentSize >= this.cleanupThreshold) {

      // Calculate how many items to remove based on threshold
      const targetSize = Math.max(
        Math.floor(this.cleanupThreshold * 0.8), // 80% of threshold
        Math.floor(this.maxSize * 0.6) // Don't go below 60% of maxSize
      );

      const entriesToRemove = currentSize - targetSize;

      if (entriesToRemove > 0) {
        this.debugLog(`Cache threshold reached: ${currentSize}, evicting ${entriesToRemove} entries`);

        // LRU eviction - remove oldest entries
        const keysToRemove = Array.from(this.cache.keys()).slice(0, entriesToRemove);

        for (const key of keysToRemove) {
          this.cache.delete(key);
        }

        this.debugLog(`Cache cleanup completed. New size: ${this.cache.size}`);
      }
    }

    // Emergency cleanup if we somehow exceed maxSize
    if (currentSize >= this.maxSize) {
      const emergencyTarget = Math.floor(this.maxSize * 0.7);
      const emergencyRemoval = currentSize - emergencyTarget;

      this.debugLog(`Emergency cleanup: ${currentSize} >= ${this.maxSize}, removing ${emergencyRemoval} entries`);

      const keysToRemove = Array.from(this.cache.keys()).slice(0, emergencyRemoval);
      for (const key of keysToRemove) {
        this.cache.delete(key);
      }
    }
  }

  performMaintenance() {
    try {
      const actualSize = this.cache.size;

      // Passive memory check
      if (typeof window !== 'undefined' && window.performance?.memory) {
        const { usedJSHeapSize, totalJSHeapSize } = window.performance.memory;
        const memoryUsageRatio = usedJSHeapSize / totalJSHeapSize;

        if (memoryUsageRatio > 0.85) {
          this.clear();
          console.warn(`[${this.name}] High memory usage detected (${Math.round(memoryUsageRatio * 100)}%), cleared cache`);
          return;
        }
      }

      if (actualSize > this.cleanupThreshold * 1.2) { // 20% tolerance above threshold
        this.debugLog(`Maintenance cleanup triggered: ${actualSize} > ${this.cleanupThreshold * 1.2}`);
        this.evictIfNeeded();
      }

      if (actualSize > this.maxSize * 1.1) { // 10% tolerance
        this.debugLog(`Cache size anomaly detected: ${actualSize}, performing emergency cleanup`);
        this.evictIfNeeded();
      }
    } catch (error) {
      this.debugLog('Maintenance error:', error.message);
    }
  }

  clear() {
    this.cache.clear();
    this.debugLog('Cache cleared');
  }

  debugLog(message, ...args) {
    if (DEBUG) {
      console.debug(`[${this.name}]`, message, ...args);
    }
  }
}

// Cache instances for shared functionality
const templateValidatorCache = new Map();
const djb2Cache = new Map();

// Utility functions for safe serialization
function safeStringify(obj) {
  const seen = new WeakSet();

  return JSON.stringify(obj, function(key, val) {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });
}

function djb2Hash(str) {
  if (djb2Cache.has(str)) {
    return djb2Cache.get(str);
  }

  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }

  // eslint-disable-next-line no-bitwise
  const result = (hash >>> 0).toString(36);

  // Prevent cache from growing too large
  if (djb2Cache.size > 10000) {
    djb2Cache.clear();
  }

  djb2Cache.set(str, result);
  return result;
}

// Exported utility functions
export function getCachedValidator(templates, debugLog) {
  const templateHash = templates.map(t => createTemplateKey(t)).join(',');

  if (templateValidatorCache.has(templateHash)) {
    debugLog('Template validator cache hit');
    return templateValidatorCache.get(templateHash);
  }

  debugLog('Template validator cache miss, creating new validator');

  // Filter valid templates with robust validation
  const validTemplates = templates.filter(template => {
    try {
      return template &&
        template.id &&
        template.properties &&
        Array.isArray(template.properties);
    } catch (error) {
      debugLog('Invalid template encountered:', error.message);
      return false;
    }
  });

  const result = { validTemplates };

  // Prevent validator cache from growing too large
  if (templateValidatorCache.size > 1000) {
    templateValidatorCache.clear();
  }

  templateValidatorCache.set(templateHash, result);

  return result;
}

export function createTemplateKey(template) {
  if (typeof template === 'string') {
    return djb2Hash(template);
  }

  try {

    // Extract only serializable properties for fingerprinting
    const fingerprintData = {
      id: template.id,
      name: template.name,
      version: template.version,
      description: template.description,
      appliesTo: Array.isArray(template.appliesTo) ? template.appliesTo.slice() : template.appliesTo,
      elementType: template.elementType,
      properties: template.properties?.map(prop => ({
        id: prop.id,
        label: prop.label,
        type: prop.type,
        binding: prop.binding ? { ...prop.binding } : undefined,
        constraints: prop.constraints ? { ...prop.constraints } : undefined,
        value: prop.value,
        feel: prop.feel,
        optional: prop.optional,
        condition: prop.condition ? { ...prop.condition } : undefined
      })) || [],
      groups: template.groups?.map(group => ({
        id: group.id,
        label: group.label,
        tooltip: group.tooltip
      })) || []
    };

    // Safe serialization with deterministic key ordering
    const serialized = safeStringify(fingerprintData);
    return djb2Hash(serialized);

  } catch (error) {
    console.warn('Template fingerprinting failed, using fallback:', error.message);

    // Fallback to basic properties
    return djb2Hash(`${template.id || ''}:${template.version || ''}:${template.name || ''}`);
  }
}

export function createPropertyValuesHash(propertyValues) {
  if (propertyValues.length === 0) {
    return '0';
  }

  // Use FNV-1a hash for better distribution and collision resistance
  let hash = 2166136261; // FNV offset basis (32-bit)

  // Sort properties by ID for deterministic hashing
  const sortedProps = propertyValues
    .slice()
    .sort((a, b) => (a.id || '').localeCompare(b.id || ''));

  for (const prop of sortedProps) {
    const key = prop.id || '';
    const value = prop.value;

    // Hash the key
    for (let i = 0; i < key.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 16777619); // FNV prime
    }

    // Hash separator
    // eslint-disable-next-line no-bitwise
    hash ^= 58; // ':' character
    hash = Math.imul(hash, 16777619);

    // Hash value with type safety
    if (value !== undefined && value !== null) {
      let valueStr;
      try {
        const valueType = typeof value;
        if (valueType === 'string') {
          valueStr = value;
        } else if (valueType === 'number' || valueType === 'boolean') {
          valueStr = String(value);
        } else {

          // Safe JSON serialization with circular reference handling
          valueStr = safeStringify(value);
        }

        for (let i = 0; i < valueStr.length; i++) {
          // eslint-disable-next-line no-bitwise
          hash ^= valueStr.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
      } catch (error) {

        // Fallback for serialization errors
        // eslint-disable-next-line no-bitwise
        hash ^= String(value).length;
        hash = Math.imul(hash, 16777619);
      }
    }
  }

  // Ensure positive 32-bit integer
  // eslint-disable-next-line no-bitwise
  return (hash >>> 0).toString(36);
}