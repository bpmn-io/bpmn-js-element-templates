import { Validator } from 'src/cloud-element-templates/Validator';

import { getZeebeSchemaVersion as getTemplateSchemaVersion } from '@bpmn-io/element-templates-validator';
import BPMNModdle from 'bpmn-moddle';

const ElementTemplateSchemaVersion = getTemplateSchemaVersion();


describe('provider/cloud-element-templates - Validator', function() {

  function errors(validator) {
    return validator.getErrors().map(function(e) {
      return e.message;
    });
  }

  function valid(validator) {
    return validator.getValidTemplates();
  }

  let moddle;

  beforeEach(function() {
    moddle = new BPMNModdle();
  });


  describe('schema version', function() {

    it('should accept when template and library have the same version', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-same-schema-version.json');

      templateDescriptor.map(function(template) {
        template.$schema = 'https://unpkg.com/@camunda/zeebe-element-templates-json-schema@' +
          ElementTemplateSchemaVersion + '/resources/schema.json';
      });

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept when template has lower version than library', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-low-schema-version.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should reject when template has higher version than library', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-high-schema-version.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(valid(templates)).to.be.empty;

      expect(errors(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept when template has no version', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept when template has latest version', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-latest-schema-version.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept and reject when some templates have unsupported version', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-mixed-schema-version.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.have.length(3);

      expect(valid(templates)).to.have.length(3);
    });


    it('should provide correct error details when rejecting', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-high-schema-version.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.have.length(6);

      expect(errors(templates)[0]).to.eql('template(id: <foo>, name: <Foo>): unsupported element template schema version <99.99.99>. Your installation only supports up to version <' + ElementTemplateSchemaVersion + '>. Please update your installation');
    });

  });


  describe('schema attribute', function() {

    it('should accept', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-defined-schema.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept - other vendor', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-other-vendor-schema.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should reject - missing $schema', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-missing-schema.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(valid(templates)).to.be.empty;

      expect(errors(templates)).to.jsonEqual([
        'template(id: <foo>, name: <Foo>): missing $schema attribute.'
      ]);
    });


    it('should reject - wrong $schema', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple-wrong-schema.json');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(valid(templates)).to.be.empty;

      expect(errors(templates)).to.jsonEqual([
        'template(id: <foo>, name: <Foo>): unsupported $schema attribute <https://unpkg.com/@camunda/element-templates-json-schema/resources/schema.json>.'
      ]);
    });

  });


  describe('content validation', function() {

    it('should accept simple example templates', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/simple');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept complex example templates', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/complex');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept connectors templates', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/connectors');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should accept optional bindings', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/optional-valid');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should reject missing name', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-name-missing');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <invalid>, name: <undefined>): missing template name');

      expect(valid(templates)).to.be.empty;
    });


    it('should reject missing id', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-id-missing');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <undefined>, name: <Invalid>): missing template id');

      expect(valid(templates)).to.be.empty;
    });


    it('should reject missing binding', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-binding-missing');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <invalid>, name: <Invalid>): missing binding for property "0"');

      expect(valid(templates)).to.be.empty;
    });


    it('should reject duplicate id', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-id-duplicate');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <foo>, name: <Foo 2>): template id <foo> already used');

      expect(valid(templates)).to.have.length(1);
    });


    it('should reject duplicate id and version', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-id-version-duplicate');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <foo>, name: <Foo 2>): template id <foo> and version <1> already used');

      expect(valid(templates)).to.have.length(1);
    });


    it('should reject invalid optional binding type', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-invalid-optional');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <invalid>, name: <Invalid>): optional is not supported for binding type "property"; must be any of { zeebe:input, zeebe:output, zeebe:property, zeebe:taskHeader }');

      expect(valid(templates)).to.be.empty;
    });


    it('should reject optional=true <-> constraints.notEmpty=true', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-optional-not-empty');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <invalid>, name: <Invalid>): optional is not allowed for truthy "notEmpty" constraint');

      expect(valid(templates)).to.be.empty;
    });


    it('should reject feel on invalid type', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/error-feel-invalid-type');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('template(id: <invalid>, name: <Invalid>): feel is only supported for "String", "Text", "Number" and "Boolean" type');

      expect(valid(templates)).to.be.empty;
    });


    describe('elementType', function() {

      it('should accept elementType', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/elementType');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.be.empty;

        expect(valid(templates)).to.have.length(templateDescriptor.length);
      });


      it('should accept elementType if applyTo only contains superClass', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/elementType-superType');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.be.empty;

        expect(valid(templates)).to.have.length(templateDescriptor.length);
      });


      it('should reject if appliesTo is missing specified element type ', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/elementType-missing-target');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.contain('template(id: <example.com.elementType-missing-target>, name: <Element Type (missing target)>): template does not apply to requested element type <bpmn:UserTask>');

        expect(valid(templates)).to.be.empty;
      });


      it('should reject invalid replace targets', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/elementType-invalid-morphs');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.contain('template(id: <example.com.TaskToGateway>, name: <Element Type (Task -> Gateway)>): can not morph <bpmn:ServiceTask> into <bpmn:ExclusiveGateway>');
        expect(errors(templates)).to.contain('template(id: <example.com.TaskToEvent>, name: <Element Type (Task -> Event)>): can not morph <bpmn:ServiceTask> into <bpmn:IntermediateCatchEvent>');
        expect(errors(templates)).to.contain('template(id: <example.com.EventToProcess>, name: <Element Type (Event -> Process)>): can not morph <bpmn:IntermediateCatchEvent> into <bpmn:Process>');

        expect(valid(templates)).to.be.empty;
      });

    });


    describe('grouping', function() {

      it('should accept groups', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/groups');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.be.empty;

        expect(valid(templates)).to.have.length(templateDescriptor.length);
      });


      it('should not accept missing group id', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/error-groups-missing-id');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.contain('template(id: <example.com.missingGroupId>, name: <Missing group id>): missing id for group "0"');

        expect(valid(templates)).to.be.empty;
      });

    });


    describe('icons', function() {

      it('should accept icons', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/icons');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.be.empty;

        expect(valid(templates)).to.have.length(templateDescriptor.length);
      });


      it('should not accept malformed uri', function() {

        // given
        const templates = new Validator(moddle);

        const templateDescriptor = require('./fixtures/error-icon-malformed');

        // when
        templates.addAll(templateDescriptor);

        // then
        expect(errors(templates)).to.contain('template(id: <icon.template.malformed-icon>, name: <Malformed Icon URI>): Malformed icon source, must be a valid HTTP(s) or data URL');

        expect(valid(templates)).to.be.empty;
      });
    });

  });


  describe('engines validation', function() {

    it('should accept template with valid semver range', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/engines');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.be.empty;

      expect(valid(templates)).to.have.length(templateDescriptor.length);
    });


    it('should reject template with invalid semver range', function() {

      // given
      const templates = new Validator(moddle);

      const templateDescriptor = require('./fixtures/engines-invalid');

      // when
      templates.addAll(templateDescriptor);

      // then
      expect(errors(templates)).to.contain('Engine <camunda> specifies invalid semver range <invalid-version>');

      expect(valid(templates)).to.be.empty;
    });

  });

});
