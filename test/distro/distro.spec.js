const {
  expect
} = require('chai');

const { spawnSync } = require('child_process');
const fs = require('fs'),
      path = require('path');

const DIST_DIR = path.join(__dirname, '../../dist');

const EXPORTS = [
  'bpmn-js-element-templates',
  'bpmn-js-element-templates/core',
  'bpmn-js-element-templates/migration',
  'bpmn-js-element-templates/migration/migrates-from.schema.json',
  'bpmn-js-element-templates/dist/assets/element-templates.css',
  'bpmn-js-element-templates/package.json'
];

describe('modules', function() {

  it('should expose CJS bundle', verifyExists('index.js'));

  it('should expose the migration API without a DOM', function() {
    const migration = require('bpmn-js-element-templates/migration');

    expect(Object.keys(migration).sort()).to.eql([
      'DestinationError', 'RecipeError', 'buildReport', 'emptyFacts',
      'findSuccessors', 'latestOf', 'migrateElement', 'parseRecipe',
      'readAppliedTemplate', 'readEmbeddedRecipe', 'resolveCatalog',
      'validateRecipeOwner'
    ]);
    Object.keys(migration).forEach(name => {
      expect(migration[name]).to.be.a('function');
    });
    expect(migration.parseRecipe({
      schemaVersion: 1,
      sources: [ { kind: 'change', sourceTemplateId: 'old' } ]
    }).sources[0]).to.eql({
      kind: 'change', sourceTemplateId: 'old', entries: []
    });
  });

  it('should expose an ESM migration bundle', async function() {
    const migration = await import('../../dist/migration.esm.mjs');

    expect(migration.migrateElement).to.be.a('function');
    expect(migration.parseRecipe).to.be.a('function');
  });

  it('should resolve the package ESM export without module syntax detection', function() {
    const result = spawnSync(process.execPath, [
      '--no-experimental-detect-module',
      '--input-type=module',
      '--eval',
      "import { parseRecipe } from 'bpmn-js-element-templates/migration'; if (typeof parseRecipe !== 'function') process.exitCode = 1;"
    ], {
      cwd: path.join(__dirname, '../..'),
      encoding: 'utf8'
    });

    expect(result.error, result.error && result.error.message).to.not.exist;
    expect(result.status, result.stderr).to.equal(0);
  });

});


describe('assets', function() {

  EXPORTS.forEach(function(asset) {

    it(`should expose "${asset}"`, function() {

      expect(() => require.resolve(asset)).not.to.throw();
    });

  });
});

function verifyExists(relativePath) {
  return function() {

    // given
    const filePath = path.join(DIST_DIR, relativePath);

    // then
    expect(fs.existsSync(filePath), `file ${relativePath} does not exist`).to.be.true;
  };
}
