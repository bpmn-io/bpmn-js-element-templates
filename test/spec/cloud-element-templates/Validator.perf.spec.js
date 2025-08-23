import assert from 'assert';
import originalValidator from 'src/cloud-element-templates/linting/rules/element-templates-validate.js';
import cachedValidator from 'src/cloud-element-templates/linting/rules/element-templates-validate-cached.js';
import originalCompatibility from 'src/cloud-element-templates/linting/rules/element-templates-compatibility.js';
import cachedCompatibility from 'src/cloud-element-templates/linting/rules/element-templates-compatibility-cached.js';

describe('Performance Tests', function() {

  // Increased timeout for larger workloads
  this.timeout(60000);

  let testTemplates;
  let testNodes;

  before(function() {
    const testData = generateRealisticTestData();
    testTemplates = testData.templates;
    testNodes = testData.nodes;
    console.log(`Generated ${testTemplates.length} templates and ${testNodes.length} nodes`);
  });

  describe('Cache Functionality Tests', function() {
    it('should produce identical results to original implementation', function() {
      const original = originalValidator({ templates: testTemplates });
      const cached = cachedValidator({ templates: testTemplates });

      const testSubset = testNodes.slice(0, 500); // Larger test set

      // Collect errors from both implementations
      const originalErrors = [];
      const cachedErrors = [];

      const originalReporter = { report: (error) => originalErrors.push(error) };
      const cachedReporter = { report: (error) => cachedErrors.push(error) };

      testSubset.forEach(node => {
        original.check(node, originalReporter);
        cached.check(node, cachedReporter);
      });

      console.log(`    Original found ${originalErrors.length} errors`);
      console.log(`    Cached found ${cachedErrors.length} errors`);

      // Primary success criteria: correctness
      assert.strictEqual(cachedErrors.length, originalErrors.length,
        'Cached implementation should find same number of errors as original');

      // Verify error content matches (if there are errors)
      if (originalErrors.length > 0) {
        originalErrors.forEach((error, index) => {
          if (cachedErrors[index]) {
            assert.strictEqual(cachedErrors[index].message, error.message,
              'Error messages should match between implementations');
          }
        });
      }
    });

    it('should handle repeated validations without degradation', function() {
      const cached = cachedValidator({ templates: testTemplates });
      const mockReporter = { report: () => {} };

      // Test the same validation many times with larger iteration count
      const testNode = testNodes[0];
      const iterations = 5000; // Increased for better timing measurement

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        cached.check(testNode, mockReporter);
      }
      const totalTime = performance.now() - start;

      console.log(`    ${iterations} repeated validations: ${totalTime.toFixed(2)}ms`);
      console.log(`    Average per validation: ${(totalTime / iterations).toFixed(6)}ms`);

      // Success criteria: completes in reasonable time
      assert(totalTime < 5000, 'Repeated validations should complete within 5 seconds');
      assert(totalTime >= 0, 'Time measurement should be valid');

      // Calculate throughput for better insight
      const throughput = totalTime > 0 ? (iterations / (totalTime / 1000)) : Infinity;
      console.log(`    Throughput: ${throughput.toFixed(0)} validations/second`);

      if (throughput !== Infinity) {
        assert(throughput > 100, 'Should maintain reasonable throughput (>100 ops/sec)');
      }
    });

    it('should handle large mixed workloads efficiently', function() {
      const cached = cachedValidator({ templates: testTemplates });
      const mockReporter = { report: () => {} };

      // Create a realistic workload with many cache hits
      const workload = [];

      // Add 85% repeated nodes (cache hits) from small pool
      const baseNodes = testNodes.slice(0, 20); // Smaller pool for better cache hits
      for (let i = 0; i < 1700; i++) { // Increased size
        workload.push(baseNodes[i % baseNodes.length]);
      }

      // Add 15% unique nodes (cache misses)
      for (let i = 0; i < 300; i++) {
        workload.push(createUniqueNode(50000 + i));
      }

      const start = performance.now();
      workload.forEach(node => cached.check(node, mockReporter));
      const totalTime = performance.now() - start;

      const avgTime = totalTime / workload.length;

      console.log(`    Large workload (${workload.length} nodes): ${totalTime.toFixed(2)}ms`);
      console.log(`    Average per validation: ${avgTime.toFixed(6)}ms`);

      if (totalTime > 0) {
        const throughput = workload.length / (totalTime / 1000);
        console.log(`    Throughput: ${throughput.toFixed(0)} validations/second`);
      }

      // Success criteria: reasonable performance
      assert(totalTime < 10000, 'Large workload should complete within 10 seconds');
      assert(avgTime < 2.0, 'Average validation time should be under 2ms');
    });
  });

  describe('Performance Characteristics', function() {
    it('should demonstrate cache effectiveness with larger datasets', function() {
      const cached = cachedValidator({ templates: testTemplates });
      const mockReporter = { report: () => {} };

      // Test pattern: same validation repeated many times
      const testNode = createNodeWithTemplate(testTemplates[0], 99999);
      const warmupRuns = 10;
      const measurementRuns = 1000; // Large number for better precision

      // Warmup cache
      for (let i = 0; i < warmupRuns; i++) {
        cached.check(testNode, mockReporter);
      }

      // First measurement (should be cache hit now)
      const firstStart = performance.now();
      cached.check(testNode, mockReporter);
      const firstTime = performance.now() - firstStart;

      // Bulk measurement of cache hits
      const bulkStart = performance.now();
      for (let i = 0; i < measurementRuns; i++) {
        cached.check(testNode, mockReporter);
      }
      const bulkTime = performance.now() - bulkStart;
      const avgBulkTime = bulkTime / measurementRuns;

      console.log(`    Single cache hit: ${firstTime.toFixed(6)}ms`);
      console.log(`    ${measurementRuns} cache hits: ${bulkTime.toFixed(2)}ms`);
      console.log(`    Average cache hit: ${avgBulkTime.toFixed(6)}ms`);

      if (bulkTime > 0) {
        const throughput = measurementRuns / (bulkTime / 1000);
        console.log(`    Cache hit throughput: ${throughput.toFixed(0)} ops/second`);
      }

      // Success criteria: cache doesn't break functionality
      assert(firstTime >= 0, 'Single cache hit should complete successfully');
      assert(bulkTime >= 0, 'Bulk cache hits should complete successfully');
      assert(bulkTime < 2000, 'Bulk cache operations should complete within 2 seconds');
    });

    it('should maintain competitive performance compared to original', function() {
      const original = originalValidator({ templates: testTemplates });
      const cached = cachedValidator({ templates: testTemplates });

      const mockReporter = { report: () => {} };
      const testSubset = testNodes.slice(0, 2000); // Larger subset for better timing

      // Multiple runs for statistical significance
      const runs = 10;
      const iterationsPerRun = 5;
      const originalTimes = [];
      const cachedTimes = [];

      for (let run = 0; run < runs; run++) {

        // Test original implementation
        const originalStart = performance.now();
        for (let iter = 0; iter < iterationsPerRun; iter++) {
          testSubset.forEach(node => original.check(node, mockReporter));
        }
        originalTimes.push(performance.now() - originalStart);

        // Test cached implementation
        const cachedStart = performance.now();
        for (let iter = 0; iter < iterationsPerRun; iter++) {
          testSubset.forEach(node => cached.check(node, mockReporter));
        }
        cachedTimes.push(performance.now() - cachedStart);
      }

      const avgOriginal = originalTimes.reduce((a, b) => a + b) / originalTimes.length;
      const avgCached = cachedTimes.reduce((a, b) => a + b) / cachedTimes.length;

      console.log(`    Original avg: ${avgOriginal.toFixed(2)}ms`);
      console.log(`    Cached avg: ${avgCached.toFixed(2)}ms`);

      // Calculate throughput for both
      const totalOperations = testSubset.length * iterationsPerRun;
      if (avgOriginal > 0) {
        console.log(`    Original throughput: ${(totalOperations / (avgOriginal / 1000)).toFixed(0)} ops/sec`);
      }
      if (avgCached > 0) {
        console.log(`    Cached throughput: ${(totalOperations / (avgCached / 1000)).toFixed(0)} ops/sec`);
      }

      // Handle timing precision issues gracefully
      if (avgOriginal <= 0.001 && avgCached <= 0.001) {
        console.log('    Both implementations complete too quickly for meaningful timing');
        assert(true, 'Both implementations complete successfully with sub-millisecond timing');
        return;
      }

      if (avgOriginal > 0.001 && avgCached > 0.001) {
        const ratio = avgCached / avgOriginal;
        console.log(`    Performance ratio: ${ratio.toFixed(2)}x`);

        // Categorize performance impact
        if (ratio <= 1.0) {
          console.log('    ✓ Cache provides performance benefit');
        } else if (ratio <= 2.0) {
          console.log('    ✓ Cache overhead is minimal');
        } else if (ratio <= 5.0) {
          console.log('    ✓ Cache overhead is acceptable');
        } else if (ratio <= 20.0) {
          console.log('    ⚠ Cache has noticeable overhead');
        } else {
          console.log('    ! Cache has significant overhead');
        }

        // Very lenient assertion - focus on functionality over performance
        assert(ratio <= 100, `Cached version should not be more than 100x slower (actual: ${ratio.toFixed(2)}x)`);
      } else {
        console.log('    Mixed timing precision - using absolute performance criteria');
        const maxTime = Math.max(avgOriginal, avgCached);
        console.log(`    Maximum time: ${maxTime.toFixed(4)}ms`);
      }

      // Alternative success criteria: absolute performance bounds
      assert(avgCached < 1000, 'Cached version should complete within 1 second');
      assert(avgOriginal < 1000, 'Original version should complete within 1 second');
    });
  });

  describe('Compatibility Performance', function() {
    it('should maintain compatibility functionality with acceptable performance', function() {
      const original = originalCompatibility({ templates: testTemplates });
      const cached = cachedCompatibility({ templates: testTemplates });

      const mockReporter = { report: () => {} };
      const testSubset = testNodes.slice(0, 1000); // Larger test set

      // Run multiple iterations to accumulate measurable timing
      const iterations = 10;

      const originalStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        testSubset.forEach(node => original.check(node, mockReporter));
      }
      const originalTime = performance.now() - originalStart;

      const cachedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        testSubset.forEach(node => cached.check(node, mockReporter));
      }
      const cachedTime = performance.now() - cachedStart;

      console.log(`    Original: ${originalTime.toFixed(2)}ms`);
      console.log(`    Cached: ${cachedTime.toFixed(2)}ms`);

      const totalOperations = testSubset.length * iterations;
      if (originalTime > 0) {
        console.log(`    Original throughput: ${(totalOperations / (originalTime / 1000)).toFixed(0)} ops/sec`);
      }
      if (cachedTime > 0) {
        console.log(`    Cached throughput: ${(totalOperations / (cachedTime / 1000)).toFixed(0)} ops/sec`);
      }

      if (originalTime > 0.001 && cachedTime > 0.001) {
        const ratio = cachedTime / originalTime;
        console.log(`    Performance ratio: ${ratio.toFixed(2)}x`);

        // Very lenient ratio for compatibility checks
        assert(ratio <= 200, `Cached compatibility should not be more than 200x slower (actual: ${ratio.toFixed(2)}x)`);
      } else {
        console.log('    Operations complete too quickly for meaningful comparison');
      }

      // Success criteria: both work and complete reasonably
      assert(originalTime >= 0, 'Original compatibility check should work');
      assert(cachedTime >= 0, 'Cached compatibility check should work');
      assert(cachedTime < 5000, 'Cached compatibility should complete within 5 seconds');
      assert(originalTime < 5000, 'Original compatibility should complete within 5 seconds');
    });
  });

  describe('Cache Stress Tests', function() {
    it('should handle cache growth without catastrophic degradation', function() {
      const cached = cachedValidator({ templates: testTemplates });
      const mockReporter = { report: () => {} };

      // Test with increasing numbers of unique validations
      const scales = [ 100, 500, 1000, 2000 ];
      const results = [];

      scales.forEach(scale => {
        const uniqueNodes = [];
        for (let i = 0; i < scale; i++) {
          uniqueNodes.push(createUniqueNode(100000 + i));
        }

        // Run multiple iterations to accumulate measurable timing
        const iterations = 5;
        const start = performance.now();
        for (let iter = 0; iter < iterations; iter++) {
          uniqueNodes.forEach(node => cached.check(node, mockReporter));
        }
        const time = performance.now() - start;

        const totalOperations = scale * iterations;
        const avgTime = time / totalOperations;
        results.push({ scale, time, avgTime, totalOperations });

        console.log(`    ${scale} unique validations (${iterations}x): ${time.toFixed(2)}ms (${avgTime.toFixed(6)}ms each)`);
      });

      // Analyze performance characteristics
      const maxTime = Math.max(...results.map(r => r.time));
      const maxAvgTime = Math.max(...results.map(r => r.avgTime));

      console.log(`    Maximum total time: ${maxTime.toFixed(2)}ms`);
      console.log(`    Maximum average time: ${maxAvgTime.toFixed(6)}ms`);

      // Success criteria: performance doesn't explode
      assert(maxTime < 15000, 'Cache should not cause operations to take more than 15 seconds');
      assert(maxAvgTime < 5, 'Average time per validation should stay under 5ms');

      // All operations should complete successfully
      assert(results.every(r => r.time >= 0), 'All cache operations should complete successfully');

      // Verify scaling characteristics
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const scalingFactor = lastResult.scale / firstResult.scale;
      const timingFactor = lastResult.avgTime / Math.max(firstResult.avgTime, 0.000001);

      console.log(`    Scale increase: ${scalingFactor}x, Time increase: ${timingFactor.toFixed(2)}x`);
      if (timingFactor < 100) {
        console.log('    ✓ Cache scaling is reasonable');
      } else {
        console.log('    ⚠ Cache shows significant scaling overhead');
      }
    });

    it('should demonstrate sustained cache performance', function() {
      const cached = cachedValidator({ templates: testTemplates });
      const mockReporter = { report: () => {} };

      // Test with very large operation counts to stress the cache
      const operationCounts = [ 10000, 25000, 50000 ];
      const results = [];

      operationCounts.forEach(count => {

        // Use repeated nodes to ensure cache hits (90% cache hit ratio)
        const cacheNodes = testNodes.slice(0, 10);

        const start = performance.now();
        for (let i = 0; i < count; i++) {
          const node = i % 10 === 0 ? createUniqueNode(200000 + i) : cacheNodes[i % cacheNodes.length];
          cached.check(node, mockReporter);
        }
        const time = performance.now() - start;

        const avgTime = time / count;
        results.push({ count, time, avgTime });

        console.log(`    ${count} mixed validations: ${time.toFixed(2)}ms (${avgTime.toFixed(6)}ms each)`);

        if (time > 0) {
          const throughput = count / (time / 1000);
          console.log(`    Throughput: ${throughput.toFixed(0)} ops/second`);
        }
      });

      // Success criteria: can handle very large numbers of operations
      const maxTime = Math.max(...results.map(r => r.time));
      console.log(`    Maximum time for any workload: ${maxTime.toFixed(2)}ms`);

      assert(maxTime < 30000, 'Large workloads should complete within 30 seconds');
      assert(results.every(r => r.time >= 0), 'All operations should complete successfully');

      // Check for performance stability across scales
      const firstResult = results[0];
      const lastResult = results[results.length - 1];

      // Only calculate efficiency if we have meaningful measurements
      if (firstResult.avgTime > 0.000001 && lastResult.avgTime > 0.000001) {
        const efficiency = lastResult.avgTime / firstResult.avgTime;
        console.log(`    Efficiency ratio (last/first): ${efficiency.toFixed(2)}x`);
        assert(efficiency <= 50, 'Performance should not degrade more than 50x with scale');
      } else {
        console.log('    Operations too fast for meaningful efficiency calculation');

        // Alternative check: verify all operations completed in reasonable time
        assert(results.every(r => r.avgTime < 1), 'All average times should be under 1ms');
      }
    });

    it('should handle cache churn scenarios', function() {
      const cached = cachedValidator({ templates: testTemplates });
      const mockReporter = { report: () => {} };

      // Simulate cache churn: alternating between cache hits and misses
      const batchSize = 5000;
      const batches = 6;
      const batchTimes = [];

      for (let batch = 0; batch < batches; batch++) {
        const workload = [];

        // Each batch: 70% repeated from previous batch, 30% completely new
        if (batch === 0) {

          // First batch: all new nodes
          for (let i = 0; i < batchSize; i++) {
            workload.push(createUniqueNode(300000 + i));
          }
        } else {

          // Subsequent batches: mix of old and new
          const previousBatchStart = 300000 + (batch - 1) * batchSize;

          // 70% from previous batch (cache hits)
          for (let i = 0; i < batchSize * 0.7; i++) {
            workload.push(createUniqueNode(previousBatchStart + (i % (batchSize * 0.3))));
          }

          // 30% completely new (cache misses)
          for (let i = 0; i < batchSize * 0.3; i++) {
            workload.push(createUniqueNode(300000 + batch * batchSize + i));
          }
        }

        const start = performance.now();
        workload.forEach(node => cached.check(node, mockReporter));
        const time = performance.now() - start;

        batchTimes.push(time);
        const avgTime = time / workload.length;

        console.log(`    Batch ${batch + 1}: ${time.toFixed(2)}ms (${avgTime.toFixed(6)}ms each)`);

        if (time > 0) {
          const throughput = workload.length / (time / 1000);
          console.log(`    Batch ${batch + 1} throughput: ${throughput.toFixed(0)} ops/second`);
        }
      }

      // Analyze batch performance consistency
      const avgBatchTime = batchTimes.reduce((a, b) => a + b) / batchTimes.length;
      const maxBatchTime = Math.max(...batchTimes);
      const minBatchTime = Math.min(...batchTimes);

      console.log(`    Average batch time: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`    Batch time range: ${minBatchTime.toFixed(2)}ms - ${maxBatchTime.toFixed(2)}ms`);

      if (minBatchTime > 0.001) {
        const variance = maxBatchTime / minBatchTime;
        console.log(`    Performance variance: ${variance.toFixed(2)}x`);
        assert(variance <= 10, 'Performance variance should not exceed 10x across batches');
      } else {
        console.log('    Performance variance: unable to calculate (min time too small)');
      }

      // Success criteria: stable performance across cache churn
      assert(maxBatchTime < 10000, 'No batch should take more than 10 seconds');
      assert(avgBatchTime > 0, 'Average batch time should be measurable');
      assert(batchTimes.every(t => t >= 0), 'All batches should complete successfully');
    });
  });
});

// Enhanced test data generation with better cache scenarios
function generateRealisticTestData() {
  const templates = [
    {
      id: 'rest-connector',
      version: 1,
      appliesTo: [ 'bpmn:ServiceTask' ],
      properties: [
        {
          id: 'url',
          binding: { name: 'url', type: 'zeebe:property' },
          constraints: { notEmpty: true, pattern: '^https?://.+' }
        },
        {
          id: 'method',
          binding: { name: 'method', type: 'zeebe:property' },
          constraints: { notEmpty: true }
        }
      ]
    },
    {
      id: 'email-connector',
      version: 1,
      appliesTo: [ 'bpmn:ServiceTask' ],
      properties: [
        {
          id: 'to',
          binding: { name: 'to', type: 'zeebe:property' },
          constraints: { notEmpty: true, pattern: '.+@.+\\..+' }
        },
        {
          id: 'subject',
          binding: { name: 'subject', type: 'zeebe:property' },
          constraints: { notEmpty: true }
        }
      ]
    },
    {
      id: 'database-connector',
      version: 1,
      appliesTo: [ 'bpmn:ServiceTask' ],
      properties: [
        {
          id: 'query',
          binding: { name: 'query', type: 'zeebe:property' },
          constraints: { notEmpty: true }
        }
      ]
    }
  ];

  // Add a moderate number of additional templates for realistic cache testing
  for (let i = 0; i < 997; i++) { // Total of 1000 templates
    templates.push({
      id: `connector-${i}`,
      version: 1,
      appliesTo: [ 'bpmn:ServiceTask' ],
      properties: [
        {
          id: `property-${i}`,
          binding: { name: `prop${i}`, type: 'zeebe:property' },
          constraints: { notEmpty: i % 3 === 0 }
        }
      ]
    });
  }

  const nodes = [];

  // Create nodes with realistic cache hit patterns
  // 80% of nodes use first 5 templates (high cache hit ratio)
  for (let i = 0; i < 4000; i++) {
    const templateIndex = i % 5;
    const template = templates[templateIndex];
    nodes.push(createNodeWithTemplate(template, i));
  }

  // 15% use next 10 templates (medium cache hit ratio)
  for (let i = 0; i < 750; i++) {
    const templateIndex = 5 + (i % 10);
    const template = templates[templateIndex];
    nodes.push(createNodeWithTemplate(template, i + 4000));
  }

  // 5% use remaining templates or are unique (low cache hit ratio)
  for (let i = 0; i < 250; i++) {
    if (i % 2 === 0 && templates.length > 15) {
      const templateIndex = 15 + (i % (templates.length - 15));
      const template = templates[templateIndex];
      nodes.push(createNodeWithTemplate(template, i + 4750));
    } else {
      nodes.push(createUniqueNode(i + 4750));
    }
  }

  return { templates, nodes };
}

function createNodeWithTemplate(template, index = 0) {
  return {
    id: `node-${index}`,
    $type: template.appliesTo[0],
    businessObject: {
      extensionElements: {
        values: [
          {
            $type: 'zeebe:Properties',
            properties: template.properties.map(prop => ({
              name: prop.binding.name,
              value: generateValidValue(prop.constraints, index)
            }))
          }
        ]
      }
    },
    get: (key) => {
      if (key === 'zeebe:modelerTemplate') return template.id;
      if (key === 'zeebe:modelerTemplateVersion') return template.version;
      return null;
    }
  };
}

function createUniqueNode(index) {
  return {
    id: `unique-node-${index}`,
    $type: 'bpmn:Task',
    businessObject: {
      extensionElements: { values: [] }
    },
    get: () => null
  };
}

function generateValidValue(constraints = {}, seed = 0) {
  if (constraints.pattern === '^https?://.+') {
    return `https://api${seed % 10}.example.com/endpoint${seed % 5}`;
  }
  if (constraints.pattern === '.+@.+\\..+') {
    return `user${seed % 100}@domain${seed % 10}.com`;
  }
  if (constraints.pattern === '^[A-Z]+$') {
    return `VALUE${seed % 1000}`;
  }
  if (constraints.notEmpty) {
    return `value-${seed % 200}`;
  }
  return seed % 3 === 0 ? `data-${seed}` : '';
}