import TestContainer from 'mocha-test-container-support';

import { domify } from 'min-dom';

import Modeler from 'bpmn-js/lib/Modeler';

import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule
} from 'bpmn-js-properties-panel';

import ZeebeBehaviorsModule from 'camunda-bpmn-js-behaviors/lib/camunda-cloud';
import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

import {
  insertBpmnStyles,
  insertCoreStyles,
  insertCSS,
  setBpmnJS
} from 'test/TestHelper';

import CloudElementTemplatesModule from 'src/cloud-element-templates';

import diagramXML from './diagram.bpmn';
import templates from './templates.json';

const singleStart = window.__env__ && window.__env__.SINGLE_START;

insertCoreStyles();
insertBpmnStyles();

insertCSS('migration-example.css', `
  .migration-example {
    display: flex;
    flex-direction: column;
    --example-properties-width: 400px;
  }

  .migration-example .bjs-container {
    padding-right: var(--example-properties-width);
  }

  .migration-example .properties-panel-container {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--example-properties-width);
    height: 100%;
    border-left: solid 1px #ccc;
    background-color: #f7f7f8;
  }
`);


/**
 * Run with `npm run start:migration`.
 */
(singleStart === 'migration' ? describe.only : describe.skip)('migration (demo)', function() {

  this.timeout(0);

  it('should migrate', async function() {

    // given
    const container = TestContainer.get(this);

    container.classList.add('migration-example');

    const modelerContainer = domify('<div class="modeler-container"></div>');

    container.appendChild(modelerContainer);

    const modeler = new Modeler({
      container: modelerContainer,
      additionalModules: [
        ZeebeBehaviorsModule,
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        ZeebePropertiesProviderModule,
        CloudElementTemplatesModule
      ],
      moddleExtensions: {
        zeebe: ZeebeModdle
      },
      elementTemplates: templates
    });

    const propertiesPanelContainer = domify('<div class="properties-panel-container"></div>');

    modeler.get('canvas').getContainer().parentNode.appendChild(propertiesPanelContainer);

    modeler.get('propertiesPanel').attachTo(propertiesPanelContainer);

    setBpmnJS(modeler);

    await modeler.importXML(diagramXML);
  });

});
