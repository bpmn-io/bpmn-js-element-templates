import RuleTester from 'bpmnlint/lib/testers/rule-tester';

import validateRule from 'src/cloud-element-templates/linting/rules/element-templates-validate';
import compatibilityRule from 'src/cloud-element-templates/linting/rules/element-templates-compatibility';

import {
  createDefinitions,
  createModdle,
  createProcess
} from '../../../TestHelper';

import templates from './LinterPlugin.json';

const valid = [
  {
    name: 'Valid Template',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.empty" />')),
    config: {
      templates
    }
  },
  {
    name: 'Conditional Template - property hidden',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.conditional" />')),
    config: {
      templates
    }
  },
  {
    name: 'No Template',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" />')),
    config: {
      templates
    }
  },
  {
    name: 'All Messages',
    moddleElement: createModdle(createDefinitions('<bpmn:message id="a" name="a" zeebe:modelerTemplate="constraints.minLength" />')),
    config: {
      templates
    }
  },
  {
    name: 'FEEL (Min Length)',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" name="=FOO" zeebe:modelerTemplate="feel.minLength" />')),
    config: {
      templates
    }
  },
  {
    name: 'FEEL (Max Length)',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" name="=FOOBAR" zeebe:modelerTemplate="feel.maxLength" />')),
    config: {
      templates
    }
  },
  {
    name: 'FEEL (Pattern)',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" name="=FOO" zeebe:modelerTemplate="feel.pattern" />')),
    config: {
      templates
    }
  }
];


const invalid = [
  {
    name: 'Template Not Found',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="missing-template" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Linked element template not found'
    }
  },
  {
    name: 'Min Length',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" name="a" zeebe:modelerTemplate="constraints.minLength" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Test Property must have min length 5.',
      propertiesPanel: { entryIds: [ 'custom-entry-constraints.minLength-0' ] },
      name: 'a'
    }
  },
  {
    name: 'Max Length',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" name="Very Long Name" zeebe:modelerTemplate="constraints.maxLength" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Test Property must have max length 5.',
      propertiesPanel: { entryIds: [ 'custom-entry-constraints.maxLength-0' ] },
      name: 'Very Long Name'
    }
  },
  {
    name: 'Not Empty',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.notEmpty" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Test Property must not be empty.',
      propertiesPanel: { entryIds: [ 'custom-entry-constraints.notEmpty-0' ] }
    }
  },
  {
    name: 'Pattern',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.pattern" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Test Property must match pattern A+B.',
      propertiesPanel: { entryIds: [ 'custom-entry-constraints.pattern-0' ] }
    }
  },
  {
    name: 'Pattern (custom message)',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.pattern-custom-message" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Test Property This is a custom message',
      propertiesPanel: { entryIds: [ 'custom-entry-constraints.pattern-custom-message-0' ] }
    }
  },
  {
    name: 'Conditional Template - property shown',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" name="foo" zeebe:modelerTemplate="constraints.conditional" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Test Property must match pattern A+B.',
      propertiesPanel: { entryIds: [ 'custom-entry-constraints.conditional-1' ] },
      name: 'foo'
    }
  }
];

const compatible = [
  {
    name: 'Template Compatible',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="compatible" />')),
    config: {
      templates
    }
  },

];

const incompatible = [
  {
    name: 'Template Incompatible',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="incompatible" />')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Element template incompatible with current environment. Template requires camunda 0; environment is using 8.5.0.'
    }
  },
  {
    name: 'Template Incompatible with update',
    moddleElement: createModdle(createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="incompatible-updatable" zeebe:modelerTemplateVersion="1"/>')),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Element template incompatible with current environment. Template requires camunda 0; environment is using 8.5.0. A compatible template version is available.'
    }
  },
];


describe('element-templates Linting', function() {

  before(function() {

    // 'assert' needs the process variable to be defined
    if (!global.process) {
      global.process = {};
    }
  });

  RuleTester.verify('element-templates', validateRule, {
    valid,
    invalid,
  });

  RuleTester.verify('element-templates', compatibilityRule, {
    valid: compatible,
    invalid: incompatible
  });

});