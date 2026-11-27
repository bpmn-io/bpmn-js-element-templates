import TestContainer from 'mocha-test-container-support';

import { domify } from 'min-dom';

import Modeler from 'bpmn-js/lib/Modeler';

import {
  html,
  render,
  useEffect,
  useRef
} from 'diagram-js/lib/ui';

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

import diagramXML from './example.bpmn';
import templates from './example-templates.json';

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

  .migration-modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(40, 40, 40, 0.2);
    font-family: Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.3;
    z-index: 1001;
  }

  .migration-modal .dialog {
    box-sizing: border-box;
    width: min(640px, calc(100vw - 40px));
    max-height: 80vh;
    overflow: auto;
    padding: 10px 20px;
    background: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .migration-modal .changes p {
    font-family: monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .migration-modal .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
`);


/**
 * Run with `npm run start:update-paths`.
 */
(singleStart === 'update-paths' ? describe.only : describe.skip)('update paths (demo)', function() {

  this.timeout(0);

  it('should review changes', async function() {

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

    // when
    embedChangesReview(modeler);
  });

});


/**
 * Application: show changes on review request.
 */
function embedChangesReview(modeler) {
  const elementTemplates = modeler.get('elementTemplates'),
        eventBus = modeler.get('eventBus');

  eventBus.on('elementTemplates.reviewChanges', ({ element, oldTemplate, newTemplate, changes }) => {
    openModal({
      from: oldTemplate,
      to: newTemplate,
      changes,
      apply: () => elementTemplates.applyTemplate(element, newTemplate)
    });
  });
}

function openModal({ from, to, changes, apply }) {
  const container = document.createElement('div');

  const close = () => {
    render(null, container);
    container.remove();
  };

  const onApply = () => {
    apply();
    close();
  };

  document.body.appendChild(container);

  render(html`
    <${ ReviewChanges }
      from=${ from }
      to=${ to }
      changes=${ changes }
      onApply=${ onApply }
      onClose=${ close } />
  `, container);
}

function ReviewChanges({ from, to, changes, onApply, onClose }) {
  const isUpdate = from.id === to.id;

  const title = isUpdate
    ? `Update ${ to.name } to version ${ to.version }`
    : `Migrate from ${ from.name } to ${ to.name }`;

  const applyRef = useRef();

  useEffect(() => {
    const onKeydown = event => event.key === 'Escape' && onClose();

    document.addEventListener('keydown', onKeydown);

    applyRef.current.focus();

    return () => document.removeEventListener('keydown', onKeydown);
  }, [ onClose ]);

  // clicking the backdrop closes
  const onBackdropClick = event => event.target === event.currentTarget && onClose();

  return html`
    <div class="migration-modal" onClick=${ onBackdropClick }>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="migration-title">
        <h3 id="migration-title">${ title }</h3>
        <div class="changes">
          ${ changes.map(change => html`
            <h4>${ getChangeTitle(change, from) }</h4>
            <p>${ renderText(change.text) }</p>
          `) }
        </div>
        <div class="actions">
          <button onClick=${ onClose }>Cancel</button>
          <button ref=${ applyRef } onClick=${ onApply }>${ isUpdate ? 'Update' : 'Migrate' }</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Title a change by the step that contributes it.
 */
function getChangeTitle(change, from) {
  const { type, template, version } = change;

  if (type === 'migration') {
    return `${ from.name } → ${ template.name }`;
  }

  return `${ template.name } v${ version }`;
}

/**
 * Render untrusted Markdown as raw text, with clickable http(s) links.
 */
function renderText(text) {
  const parts = [];

  let index = 0;

  for (const match of text.matchAll(/https?:\/\/[^\s()<>"']+/g)) {
    parts.push(
      text.slice(index, match.index),
      html`<a href=${ match[0] } target="_blank" rel="noopener noreferrer">${ match[0] }</a>`
    );

    index = match.index + match[0].length;
  }

  parts.push(text.slice(index));

  return parts;
}
