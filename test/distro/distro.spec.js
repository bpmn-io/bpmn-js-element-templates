const {
  expect
} = require('chai');

const fs = require('fs'),
      path = require('path');

const DIST_DIR = path.join(__dirname, '../../dist');

const EXPORTS = [
  'bpmn-js-element-templates',
  'bpmn-js-element-templates/core',
  'bpmn-js-element-templates/dist/assets/element-templates.css',
  'bpmn-js-element-templates/package.json'
];

describe('modules', function() {

  it('should expose CJS bundle', verifyExists('index.js'));

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
