import { expect } from 'chai';

import { checkUpdate } from 'src/cloud-element-templates/util/checkUpdate';


describe('cloud-element-templates/util - checkUpdate', function() {

  const url = { type: 'zeebe:input', name: 'url' };
  const endpoint = { type: 'zeebe:input', name: 'endpoint' };
  const method = { type: 'zeebe:taskHeader', key: 'method' };

  const methodDropdown = {
    label: 'Method',
    type: 'Dropdown',
    binding: method,
    choices: [
      { name: 'GET', value: 'GET' },
      { name: 'POST', value: 'POST' }
    ]
  };

  function template(version, properties, updatePaths) {
    return { id: 'rest', name: 'REST', version, properties, updatePaths };
  }


  it('should accept compatible update', function() {

    // given
    const oldTemplate = template(1, [
      { label: 'URL', type: 'String', binding: url }
    ]);

    const newTemplate = template(2, [
      { label: 'URL', type: 'String', binding: url },
      { label: 'Timeout', type: 'String', binding: { type: 'zeebe:input', name: 'timeout' } }
    ]);

    // then
    expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
  });


  it('should report dropped binding', function() {

    // given
    const oldTemplate = template(1, [
      { label: 'URL', type: 'String', binding: url }
    ]);

    const newTemplate = template(2, [
      { label: 'Endpoint', type: 'String', binding: endpoint }
    ]);

    // then
    expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
      { type: 'drop', binding: url, label: 'URL', message: 'URL is not carried over' }
    ]);
  });


  it('should accept binding moved by update path', function() {

    // given
    const oldTemplate = template(1, [
      { label: 'URL', type: 'String', binding: url }
    ]);

    const newTemplate = template(2, [
      { label: 'Endpoint', type: 'String', binding: endpoint }
    ], [
      { beforeVersion: 2, hints: [ { from: url, to: endpoint } ] }
    ]);

    // then
    expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
  });


  it('should report binding moved to Hidden property', function() {

    // given
    const oldTemplate = template(1, [
      { label: 'URL', type: 'String', binding: url }
    ]);

    const newTemplate = template(2, [
      { type: 'Hidden', value: 'https://example.com', binding: url }
    ]);

    // then
    expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
      { type: 'drop', binding: url, label: 'URL', message: 'URL is not carried over' }
    ]);
  });


  describe('choices', function() {

    it('should report dropped choice', function() {

      // given
      const oldTemplate = template(1, [ methodDropdown ]);

      const newTemplate = template(2, [
        {
          ...methodDropdown,
          choices: [
            { name: 'GET', value: 'get' },
            { name: 'POST', value: 'POST' }
          ]
        }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        {
          type: 'drop',
          binding: method,
          label: 'Method',
          value: 'GET',
          message: 'Method choice <GET> is not carried over'
        }
      ]);
    });


    it('should accept choice mapped by update path', function() {

      // given
      const oldTemplate = template(1, [ methodDropdown ]);

      const newTemplate = template(2, [
        {
          ...methodDropdown,
          choices: [
            { name: 'GET', value: 'get' },
            { name: 'POST', value: 'post' }
          ]
        }
      ], [
        { beforeVersion: 2, hints: [ { from: method, to: method, values: { GET: 'get', POST: 'post' } } ] }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
    });


    it('should report input that only survives as a choice', function() {

      // given
      const oldTemplate = template(1, [
        { label: 'Method', type: 'String', binding: method }
      ]);

      const newTemplate = template(2, [ methodDropdown ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        {
          type: 'drop',
          binding: method,
          label: 'Method',
          message: 'Method is not carried over, unless it matches a choice'
        }
      ]);
    });

  });


  describe('constraints', function() {

    it('should report stricter constraints', function() {

      // given
      const oldTemplate = template(1, [
        { label: 'URL', type: 'String', binding: url, constraints: { maxLength: 100 } }
      ]);

      const newTemplate = template(2, [
        { label: 'URL', type: 'String', binding: url, constraints: { notEmpty: true, maxLength: 100 } }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        { type: 'invalidate', binding: url, label: 'URL', message: 'URL may become invalid' }
      ]);
    });


    it('should report changed pattern', function() {

      // given
      const oldTemplate = template(1, [
        { label: 'URL', type: 'String', binding: url, constraints: { pattern: '^https?://' } }
      ]);

      const newTemplate = template(2, [
        { label: 'URL', type: 'String', binding: url, constraints: { pattern: { value: '^https://', message: 'Must be https' } } }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        { type: 'invalidate', binding: url, label: 'URL', message: 'URL may become invalid' }
      ]);
    });


    it('should accept looser constraints', function() {

      // given
      const oldTemplate = template(1, [
        { label: 'URL', type: 'String', binding: url, constraints: { notEmpty: true, maxLength: 100 } }
      ]);

      const newTemplate = template(2, [
        { label: 'URL', type: 'String', binding: url, constraints: { maxLength: 200 } }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
    });


    it('should report mapped value violating constraints', function() {

      // given
      const oldTemplate = template(1, [ methodDropdown ]);

      const newTemplate = template(2, [
        { label: 'Method', type: 'String', binding: method, constraints: { pattern: '^[a-z]+$' } }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        {
          type: 'invalidate',
          binding: method,
          label: 'Method',
          value: 'GET',
          message: 'Method choice <GET> becomes invalid'
        },
        {
          type: 'invalidate',
          binding: method,
          label: 'Method',
          value: 'POST',
          message: 'Method choice <POST> becomes invalid'
        }
      ]);
    });

  });


  describe('conditions', function() {

    const auth = { id: 'auth', label: 'Auth', type: 'String', binding: { type: 'zeebe:input', name: 'auth' } };

    it('should report new condition', function() {

      // given
      const oldTemplate = template(1, [
        auth,
        { label: 'URL', type: 'String', binding: url }
      ]);

      const newTemplate = template(2, [
        auth,
        { label: 'URL', type: 'String', binding: url, condition: { property: 'auth', equals: 'none' } }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        {
          type: 'drop',
          binding: url,
          label: 'URL',
          message: 'URL may not be carried over, if its condition is not met'
        }
      ]);
    });


    it('should accept unchanged condition', function() {

      // given
      const condition = { property: 'auth', equals: 'none' };

      const oldTemplate = template(1, [
        auth,
        { label: 'URL', type: 'String', binding: url, condition }
      ]);

      const newTemplate = template(2, [
        auth,
        { label: 'URL', type: 'String', binding: url, condition }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
    });


    it('should accept condition on renamed property', function() {

      // given
      const oldTemplate = template(1, [
        auth,
        { label: 'URL', type: 'String', binding: url, condition: { property: 'auth', equals: 'none' } }
      ]);

      const newTemplate = template(2, [
        { ...auth, id: 'authentication' },
        {
          label: 'URL',
          type: 'String',
          binding: url,
          condition: { property: 'authentication', equals: 'none', type: 'simple' }
        }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
    });


    it('should accept condition on new property, met by default', function() {

      // given
      const configuration = {
        id: 'configuration',
        type: 'String',
        binding: { type: 'zeebe:input', name: 'configuration' }
      };

      const oldTemplate = template(1, [
        { label: 'URL', type: 'String', binding: url }
      ]);

      const newTemplate = template(2, [
        configuration,
        { label: 'URL', type: 'String', binding: url, condition: { property: 'configuration', isEmpty: true } }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
    });

  });


  describe('interpretation', function() {

    it('should report changed FEEL mode', function() {

      // given
      const oldTemplate = template(1, [
        { label: 'URL', type: 'String', binding: url }
      ]);

      const newTemplate = template(2, [
        { label: 'URL', type: 'String', binding: url, feel: 'required' }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        { type: 'reinterpret', binding: url, label: 'URL', message: 'URL is interpreted differently' }
      ]);
    });


    it('should report changed kind of value', function() {

      // given
      const oldTemplate = template(1, [
        { label: 'Retries', type: 'String', binding: url }
      ]);

      const newTemplate = template(2, [
        { label: 'Retries', type: 'Number', binding: url }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        { type: 'reinterpret', binding: url, label: 'Retries', message: 'Retries is interpreted differently' }
      ]);
    });

  });


  describe('migration', function() {

    it('should accept input moved by migration path', function() {

      // given
      const oldTemplate = {
        id: 'legacy',
        version: 1,
        properties: [ { label: 'URL', type: 'String', binding: url } ]
      };

      const newTemplate = template(1, [
        { label: 'Endpoint', type: 'String', binding: endpoint }
      ], [
        { templateId: 'legacy', hints: [ { from: url, to: endpoint } ] }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.be.empty;
    });


    it('should report input without migration path', function() {

      // given
      const oldTemplate = {
        id: 'legacy',
        version: 1,
        properties: [ { label: 'URL', type: 'String', binding: url } ]
      };

      const newTemplate = template(1, [
        { label: 'Endpoint', type: 'String', binding: endpoint }
      ]);

      // then
      expect(checkUpdate(oldTemplate, newTemplate)).to.eql([
        { type: 'drop', binding: url, label: 'URL', message: 'URL is not carried over' }
      ]);
    });

  });

});
