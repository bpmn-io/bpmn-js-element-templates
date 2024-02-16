const {
  expect
} = require('chai');


describe('exports', function() {

  it('should expose CJS bundle', function() {

    expect(() => require.resolve('bpmn-js-element-templates')).not.to.throw;
    expect(() => require.resolve('bpmn-js-elemenet-templates/core')).not.to.throw;

  });

});


describe('assets', function() {

  const EXPORTS = [
    'bpmn-js-element-templates',
    'bpmn-js-element-templates/core',
    'bpmn-js-element-templates/dist/assets/element-templates.css',
    'bpmn-js-element-templates/package.json'
  ];

  EXPORTS.forEach(function(asset) {

    it(`should expose <${asset}>`, function() {

      expect(() => require.resolve(asset)).not.to.throw();

    });

  });

});