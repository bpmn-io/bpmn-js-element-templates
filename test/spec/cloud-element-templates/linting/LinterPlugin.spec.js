import RuleTester from 'bpmnlint/lib/testers/rule-tester';

import validateRule from 'src/cloud-element-templates/linting/rules/element-templates-validate';
import validateCachedRule from 'src/cloud-element-templates/linting/rules/element-templates-validate-cached';
import compatibilityRule from 'src/cloud-element-templates/linting/rules/element-templates-compatibility';
import compatibilityCachedRule from 'src/cloud-element-templates/linting/rules/element-templates-compatibility-cached';

import templates from './LinterPlugin.json';

import BPMNModdle from 'bpmn-moddle';
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

const valid = [
  {
    name: 'Valid Template',
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.empty" />'),
    config: {
      templates
    }
  },
  {
    name: 'Conditional Template - property hidden',
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.conditional" />'),
    config: {
      templates
    }
  },
  {
    name: 'No Template',
    moddleElement: createProcess('<bpmn:task id="Task_1" />'),
    config: {
      templates
    }
  },
  {
    name: 'All Messages',
    moddleElement: createDefinitions('<bpmn:message id="a" name="a" zeebe:modelerTemplate="constraints.minLength" />'),
    config: {
      templates
    }
  },
  {
    name: 'FEEL (Min Length)',
    moddleElement: createProcess('<bpmn:task id="Task_1" name="=FOO" zeebe:modelerTemplate="feel.minLength" />'),
    config: {
      templates
    }
  },
  {
    name: 'FEEL (Max Length)',
    moddleElement: createProcess('<bpmn:task id="Task_1" name="=FOOBAR" zeebe:modelerTemplate="feel.maxLength" />'),
    config: {
      templates
    }
  },
  {
    name: 'FEEL (Pattern)',
    moddleElement: createProcess('<bpmn:task id="Task_1" name="=FOO" zeebe:modelerTemplate="feel.pattern" />'),
    config: {
      templates
    }
  }
];


const invalid = [
  {
    name: 'Template Not Found',
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="missing-template" />'),
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
    moddleElement: createProcess('<bpmn:task id="Task_1" name="a" zeebe:modelerTemplate="constraints.minLength" />'),
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
    moddleElement: createProcess('<bpmn:task id="Task_1" name="Very Long Name" zeebe:modelerTemplate="constraints.maxLength" />'),
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
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.notEmpty" />'),
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
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.pattern" />'),
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
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="constraints.pattern-custom-message" />'),
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
    moddleElement: createProcess('<bpmn:task id="Task_1" name="foo" zeebe:modelerTemplate="constraints.conditional" />'),
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
    name: 'Template compatible',
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="compatible" />'),
    config: {
      templates
    }
  },

  {
    name: 'Template compatible (no execution platform)',
    moddleElement: createProcess(
      '<bpmn:task id="Task_1" zeebe:modelerTemplate="compatible" />',
      '',
      { executionPlatform: '' }
    ),
    config: {
      templates
    }
  },

  {
    name: 'Template compatible (no execution platform version)',
    moddleElement: createProcess(
      '<bpmn:task id="Task_1" zeebe:modelerTemplate="compatible" />',
      '',
      { executionPlatform: '8.5' }),
    config: {
      templates
    }
  },
];

const incompatible = [
  {
    name: 'Template incompatible',
    moddleElement: createProcess('<bpmn:task id="Task_1" zeebe:modelerTemplate="incompatible" />'),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Element template incompatible with current <camunda> environment. Requires \'camunda 0\'; found \'8.5.0\'.'
    }
  },
  {
    name: 'Template incompatible with update',
    moddleElement: createProcess(
      '<bpmn:task id="Task_1" zeebe:modelerTemplate="incompatible-updatable" zeebe:modelerTemplateVersion="1" />'
    ),
    config: {
      templates
    },
    report: {
      id: 'Task_1',
      message: 'Element template incompatible with current <camunda> environment. Requires \'camunda 0\'; found \'8.5.0\'. Update available.'
    }
  },
];


describe('cloud-element-templates/linting', function() {

  before(function() {

    // 'assert' needs the process variable to be defined
    if (!global.process) {
      global.process = {};
    }
  });

  RuleTester.verify('element-templates/validate', validateRule, {
    valid,
    invalid,
  });

  RuleTester.verify('element-templates/validate-cached', validateCachedRule, {
    valid,
    invalid,
  });

  RuleTester.verify('element-templates/compatibility', compatibilityRule, {
    valid: compatible,
    invalid: incompatible
  });

  RuleTester.verify('element-templates/compatibility-cached', compatibilityCachedRule, {
    valid: compatible,
    invalid: incompatible
  });

});


// helpers ///////////

async function createModdle(xml) {
  const moddle = new BPMNModdle({
    zeebe: zeebeModdle
  });

  const {
    rootElement: root,
    warnings = []
  } = await moddle.fromXML(xml, 'bpmn:Definitions', { lax: true });

  return {
    root,
    moddle,
    context: {
      warnings
    },
    warnings
  };
}

function createDefinitions(xml = '', { executionPlatform, executionPlatformVersion } = {
  executionPlatform: 'Camunda Cloud',
  executionPlatformVersion: '8.5'
}) {

  return createModdle(`
    <bpmn:definitions
      xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
      xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
      xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
      xmlns:modeler="http://camunda.org/schema/modeler/1.0"
      xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
      ${ executionPlatform ? `modeler:executionPlatform="${executionPlatform}"` : '' }
      ${ executionPlatformVersion ? `modeler:executionPlatformVersion="${executionPlatformVersion}"` : '' }
      id="Definitions_1">
      ${ xml }
    </bpmn:definitions>
  `);
}


function createProcess(bpmn = '', bpmndi = '', options) {
  return createDefinitions(`
    <bpmn:process id="Process_1" isExecutable="true">
      ${ bpmn }
    </bpmn:process>
    ${ bpmndi }
  `, options);
}