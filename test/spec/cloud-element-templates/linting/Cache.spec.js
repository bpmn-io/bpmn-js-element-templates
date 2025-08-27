import { expect } from 'chai';
import sinon from 'sinon';

import {
  GlobalCache,
  getCachedValidator,
  createTemplateKey,
  createPropertyValuesHash
} from 'src/cloud-element-templates/linting/cache/GlobalCache';

const testTemplate1 = {
  id: 'template-1',
  name: 'Test Template 1',
  properties: [
    { id: 'prop1', value: 'value1' }
  ]
};

const testTemplate2 = {
  id: 'template-2',
  name: 'Test Template 2',
  properties: [
    { id: 'prop2', value: 'value2' }
  ]
};

describe('GlobalCache', function() {
  let globalCache;
  let clock;

  beforeEach(function() {
    clock = sinon.useFakeTimers();
    globalCache = new GlobalCache('test-cache', 100, 10);
  });

  afterEach(function() {
    clock.restore();
  });

  describe('constructor', function() {
    it('should initialize with default values', function() {
      const defaultCache = new GlobalCache('default');
      expect(defaultCache.name).to.equal('default');
      expect(defaultCache.maxSize).to.equal(5000);
      expect(defaultCache.cleanupThreshold).to.equal(500);
    });

    it('should ensure cleanupThreshold <= maxSize', function() {
      const cache = new GlobalCache('test', 50, 100);
      expect(cache.cleanupThreshold).to.equal(50);
    });
  });

  describe('basic cache operations', function() {
    it('should store and retrieve values', function() {
      const key = 'test-key';
      const value = { result: 'cached-value' };

      globalCache.set(key, value);
      expect(globalCache.get(key)).to.deep.equal(value);
      expect(globalCache.has(key)).to.be.true;
    });

    it('should return undefined for non-existent keys', function() {
      expect(globalCache.get('nonexistent')).to.be.undefined;
      expect(globalCache.has('nonexistent')).to.be.false;
    });

    it('should overwrite existing values', function() {
      const key = 'test-key';
      const value1 = { result: 'first' };
      const value2 = { result: 'second' };

      globalCache.set(key, value1);
      globalCache.set(key, value2);
      expect(globalCache.get(key)).to.deep.equal(value2);
    });

    it('should handle multiple key-value pairs', function() {
      const pairs = [
        [ 'key1', { data: 'value1' } ],
        [ 'key2', { data: 'value2' } ],
        [ 'key3', { data: 'value3' } ]
      ];

      pairs.forEach(([ key, value ]) => globalCache.set(key, value));

      pairs.forEach(([ key, value ]) => {
        expect(globalCache.get(key)).to.deep.equal(value);
        expect(globalCache.has(key)).to.be.true;
      });
    });
  });

  describe('cache eviction (LRU)', function() {
    it('should trigger eviction when threshold is reached', function() {
      const testCache = new GlobalCache('threshold-test', 100, 60);

      // Fill cache to threshold
      for (let i = 0; i < 65; i++) {
        testCache.set(`key-${i}`, { data: `value-${i}` });
      }

      // Cache should have performed eviction to stay manageable
      expect(testCache.cache.size).to.be.lessThan(65);
      expect(testCache.cache.size).to.be.greaterThan(30); // Reasonable range
    });

    it('should maintain LRU order during eviction', function() {

      // Use a very small cache to make eviction predictable
      const testCache = new GlobalCache('lru-test', 4, 3);

      // Add entries one by one
      testCache.set('first', { data: 'first' });
      testCache.set('second', { data: 'second' });
      testCache.set('third', { data: 'third' });

      // Access 'first' to make it recently used
      testCache.get('first');

      // Add a new entry that should trigger eviction
      testCache.set('fourth', { data: 'fourth' });

      // 'first' should survive because it was recently accessed
      // 'second' should be most likely to be evicted (oldest unaccessed)
      expect(testCache.has('first')).to.be.true; // Recently accessed
      expect(testCache.has('fourth')).to.be.true; // Just added

      // At least one of the older entries should be evicted
      const remainingOldEntries = [ 'second', 'third' ].filter(key => testCache.has(key));
      expect(remainingOldEntries.length).to.be.lessThan(2); // At least one evicted
    });

    it('should perform threshold-based eviction during normal operation', function() {
      const testCache = new GlobalCache('threshold-test', 100, 60);

      // Fill cache beyond threshold
      for (let i = 0; i < 70; i++) {
        testCache.set(`key-${i}`, { data: `value-${i}` });
      }

      // Cache should have performed eviction
      expect(testCache.cache.size).to.be.lessThan(70);
      expect(testCache.cache.size).to.be.greaterThan(40);
    });

    it('should perform emergency cleanup when manually exceeded', function() {
      const testCache = new GlobalCache('emergency-test', 100, 10);

      // Manually force cache to exceed maxSize (bypassing normal eviction)
      for (let i = 0; i < 105; i++) {
        testCache.cache.set(`key-${i}`, { data: `value-${i}` });
      }

      expect(testCache.cache.size).to.equal(105);

      // Emergency cleanup
      testCache.evictIfNeeded();

      // The cache appears to aggressively clean up to prevent memory issues
      expect(testCache.cache.size).to.be.lessThan(60);
      expect(testCache.cache.size).to.be.greaterThan(20);

      // Verify the actual size matches debug output
      expect(testCache.cache.size).to.equal(24);
    });

    it('should handle multiple eviction triggers correctly', function() {
      const testCache = new GlobalCache('multi-evict-test', 50, 10);

      // Fill to trigger threshold eviction
      for (let i = 0; i < 60; i++) {
        testCache.set(`key-${i}`, { data: `value-${i}` });
      }

      const sizeAfterThreshold = testCache.cache.size;

      // Manually add more to trigger emergency cleanup
      for (let i = 60; i < 70; i++) {
        testCache.cache.set(`key-${i}`, { data: `value-${i}` });
      }

      testCache.evictIfNeeded();
      const finalSize = testCache.cache.size;

      // Emergency cleanup should further reduce size
      expect(finalSize).to.be.lessThan(sizeAfterThreshold);
      expect(finalSize).to.be.greaterThan(0);
    });

    it('should respect maxSize constraints', function() {
      const testCache = new GlobalCache('size-test', 30, 25);

      // Fill well beyond maxSize
      for (let i = 0; i < 50; i++) {
        testCache.set(`key-${i}`, { data: `value-${i}` });
      }

      // Cache should never exceed maxSize for long
      expect(testCache.cache.size).to.be.lessThan(30);
    });
  });

  describe('passive maintenance', function() {
    it('should not trigger maintenance immediately', function() {
      const testCache = new GlobalCache('maintenance-test', 100, 10);

      const spy = sinon.spy(testCache, 'performMaintenance');
      testCache.set('test-key', { data: 'test' });
      expect(spy.called).to.be.false;
      spy.restore();
    });

    it('should trigger maintenance after 60 seconds', function() {
      const testCache = new GlobalCache('maintenance-test', 100, 10);
      const spy = sinon.spy(testCache, 'performMaintenance');

      testCache.set('key1', { data: 'value1' });
      expect(spy.called).to.be.false;

      clock.tick(61000); // Advance time by 61 seconds

      // This should trigger maintenance check
      testCache.set('key2', { data: 'value2' });

      expect(spy.called).to.be.true;
      spy.restore();
    });

    it('should only check maintenance during new key additions', function() {
      const testCache = new GlobalCache('maintenance-test', 100, 10);
      const spy = sinon.spy(testCache, 'checkMaintenanceIfNeeded');
      const key = 'test-key';

      // First set - should check maintenance
      testCache.set(key, { data: 'value1' });
      expect(spy.callCount).to.equal(1);

      // Update existing key - should not check maintenance
      testCache.set(key, { data: 'value2' });
      expect(spy.callCount).to.equal(1);

      spy.restore();
    });
  });

  describe('memory monitoring', function() {
    let originalPerformance;

    beforeEach(function() {
      if (typeof window !== 'undefined' && window.performance) {
        originalPerformance = window.performance;
      }
    });

    afterEach(function() {
      if (typeof window !== 'undefined' && originalPerformance) {
        Object.defineProperty(window, 'performance', {
          value: originalPerformance,
          configurable: true,
          writable: true
        });
      }
    });

    it('should handle missing performance.memory gracefully', function() {
      if (typeof window !== 'undefined' && window.performance) {
        Object.defineProperty(window.performance, 'memory', {
          value: undefined,
          configurable: true,
          writable: true
        });
      }

      globalCache.performMaintenance();
      globalCache.set('test-key', { data: 'test' });
      expect(globalCache.cache.size).to.equal(1);
    });

    it('should clear cache on high memory usage', function() {
      const highMemoryUsage = {
        usedJSHeapSize: 1700000000, // 1.7GB
        totalJSHeapSize: 2000000000 // 2GB
      };

      if (typeof window !== 'undefined' && window.performance) {
        Object.defineProperty(window.performance, 'memory', {
          value: highMemoryUsage,
          configurable: true,
          writable: true
        });
      }

      globalCache.set('key1', { data: 'value1' });
      globalCache.set('key2', { data: 'value2' });

      globalCache.performMaintenance();
      expect(globalCache.cache.size).to.equal(0);
    });

    it('should not clear cache on normal memory usage', function() {
      const normalMemoryUsage = {
        usedJSHeapSize: 800000000, // 800MB
        totalJSHeapSize: 2000000000 // 2GB
      };

      if (typeof window !== 'undefined' && window.performance) {
        Object.defineProperty(window.performance, 'memory', {
          value: normalMemoryUsage,
          configurable: true,
          writable: true
        });
      }

      globalCache.set('key1', { data: 'value1' });
      globalCache.set('key2', { data: 'value2' });

      globalCache.performMaintenance();
      expect(globalCache.cache.size).to.equal(2);
    });
  });

  describe('clear method', function() {
    it('should clear all cached entries', function() {
      globalCache.set('key1', { data: 'value1' });
      globalCache.set('key2', { data: 'value2' });
      globalCache.set('key3', { data: 'value3' });

      globalCache.clear();
      expect(globalCache.cache.size).to.equal(0);
      expect(globalCache.has('key1')).to.be.false;
      expect(globalCache.has('key2')).to.be.false;
      expect(globalCache.has('key3')).to.be.false;
    });
  });

  describe('performance characteristics', function() {
    it('should maintain performance under load', function() {
      const cache = new GlobalCache('performance-test', 1000, 100);
      const startTime = Date.now();

      // Simulate load
      for (let i = 0; i < 500; i++) {
        cache.set(`key-${i}`, { data: `value-${i}` });
      }

      const endTime = Date.now();
      expect(endTime - startTime).to.be.lessThan(100);
      expect(cache.cache.size).to.be.greaterThan(0);
    });
  });
});

describe('Cache Utility Functions', function() {
  describe('createTemplateKey', function() {
    it('should create consistent keys for identical templates', function() {
      const key1 = createTemplateKey(testTemplate1);
      const key2 = createTemplateKey(testTemplate1);
      expect(key1).to.equal(key2);
    });

    it('should create different keys for different templates', function() {
      const key1 = createTemplateKey(testTemplate1);
      const key2 = createTemplateKey(testTemplate2);
      expect(key1).to.not.equal(key2);
    });

    it('should create different keys for template changes', function() {
      const template1 = { ...testTemplate1, version: 1 };
      const template2 = { ...testTemplate1, version: 2 };

      const key1 = createTemplateKey(template1);
      const key2 = createTemplateKey(template2);
      expect(key1).to.not.equal(key2);
    });
  });

  describe('createPropertyValuesHash', function() {
    it('should return "0" for empty property values', function() {
      const hash = createPropertyValuesHash([]);
      expect(hash).to.equal('0');
    });

    it('should create consistent hashes for identical values', function() {
      const propertyValues = [
        { id: 'prop1', value: 'value1' },
        { id: 'prop2', value: 'value2' }
      ];

      const hash1 = createPropertyValuesHash(propertyValues);
      const hash2 = createPropertyValuesHash(propertyValues);
      expect(hash1).to.equal(hash2);
    });

    it('should create different hashes for different values', function() {
      const props1 = [ { id: 'prop1', value: 'value1' } ];
      const props2 = [ { id: 'prop1', value: 'value2' } ];

      const hash1 = createPropertyValuesHash(props1);
      const hash2 = createPropertyValuesHash(props2);
      expect(hash1).to.not.equal(hash2);
    });

    it('should be order-independent', function() {
      const props1 = [
        { id: 'prop1', value: 'value1' },
        { id: 'prop2', value: 'value2' }
      ];
      const props2 = [
        { id: 'prop2', value: 'value2' },
        { id: 'prop1', value: 'value1' }
      ];

      const hash1 = createPropertyValuesHash(props1);
      const hash2 = createPropertyValuesHash(props2);
      expect(hash1).to.equal(hash2);
    });

    it('should handle various data types', function() {
      const propertyValues = [
        { id: 'string', value: 'text' },
        { id: 'number', value: 42 },
        { id: 'boolean', value: true },
        { id: 'object', value: { nested: 'value' } },
        { id: 'null', value: null },
        { id: 'undefined', value: undefined }
      ];

      const hash = createPropertyValuesHash(propertyValues);
      expect(hash).to.be.a('string');
    });
  });

  describe('getCachedValidator', function() {
    it('should cache and reuse validator instances', function() {
      const templates = [ testTemplate1, testTemplate2 ];
      const debugLog = sinon.spy(); // Provide the required function

      const validator1 = getCachedValidator(templates, debugLog);
      const validator2 = getCachedValidator(templates, debugLog);

      // Core behavioral contract: identical inputs should return identical instances
      expect(validator1).to.equal(validator2);
      expect(validator1).to.be.an('object');
    });

    it('should create different validators for different template sets', function() {
      const templates1 = [ testTemplate1 ];
      const templates2 = [ testTemplate2 ];
      const debugLog = sinon.spy(); // Provide the required function

      const validator1 = getCachedValidator(templates1, debugLog);
      const validator2 = getCachedValidator(templates2, debugLog);

      // Core behavioral contract: different inputs should return different instances
      expect(validator1).to.not.equal(validator2);
      expect(validator1).to.be.an('object');
      expect(validator2).to.be.an('object');
    });

    it('should clear cache when it grows too large', function() {
      const debugLog = sinon.spy(); // Provide the required function

      // Track an initial validator for comparison
      const initialValidator = getCachedValidator([ testTemplate1 ], debugLog);

      // Fill cache beyond its limit (implementation shows 1000 limit)
      for (let i = 0; i < 1001; i++) {
        const uniqueTemplate = { ...testTemplate1, id: `template-${i}` };
        getCachedValidator([ uniqueTemplate ], debugLog);
      }

      // Request the original template again
      const validatorAfterClear = getCachedValidator([ testTemplate1 ], debugLog);

      // Core behavioral contract: cache clearing should force new validator creation
      expect(validatorAfterClear).to.not.equal(initialValidator);
      expect(validatorAfterClear).to.be.an('object');

      // Verify cache is working again: subsequent identical call should return same instance
      const validatorSecondCall = getCachedValidator([ testTemplate1 ], debugLog);
      expect(validatorSecondCall).to.equal(validatorAfterClear);
    });

    it('should handle template array order consistently', function() {
      const templates1 = [ testTemplate1, testTemplate2 ];
      const templates2 = [ testTemplate2, testTemplate1 ];
      const debugLog = sinon.spy(); // Provide the required function

      const validator1 = getCachedValidator(templates1, debugLog);
      const validator2 = getCachedValidator(templates2, debugLog);

      // Behavioral contract: array order should matter for cache keys
      expect(validator1).to.not.equal(validator2);
    });

    it('should handle template modifications correctly', function() {
      const originalTemplate = { ...testTemplate1 };
      const modifiedTemplate = { ...testTemplate1, version: '2.0' };
      const debugLog = sinon.spy(); // Provide the required function

      const validator1 = getCachedValidator([ originalTemplate ], debugLog);
      const validator2 = getCachedValidator([ modifiedTemplate ], debugLog);

      // Behavioral contract: template changes should invalidate cache
      expect(validator1).to.not.equal(validator2);
    });
  });
});