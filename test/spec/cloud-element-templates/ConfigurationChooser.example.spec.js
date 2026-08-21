import TestContainer from 'mocha-test-container-support';

import { render } from '@bpmn-io/properties-panel/preact';

import {
  insertCoreStyles,
  insertCSS
} from 'test/TestHelper';

import {
  ConfigurationContextMenu,
  ConfigurationPopover,
  ErrorConfiguration,
  LoadingConfiguration,
  MissingConfiguration,
  OfflineConfiguration,
  PlaceholderConfiguration,
  SelectedConfiguration
} from 'src/cloud-element-templates/properties-panel/properties/custom-properties/ConfigurationProperty';

const singleStart = window.__env__ && window.__env__.SINGLE_START;

insertCoreStyles();

// layout chrome for the board — not part of the component, only to arrange the
// examples so their styling is easy to eyeball and discuss side by side
insertCSS('configuration-chooser-example.css', `
  /* let the page host the full board (last dropdown row is tall) */
  html, body {
    height: auto;
    min-height: 100%;
    overflow: auto;
  }

  /* the mocha test container clips overflow by default; let it grow so tall
     sections (open menu / dropdown) are fully visible */
  .cb-test-container {
    position: static;
    height: fit-content !important;
    overflow: visible;
  }

  .cb-board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 28px 24px;
    padding: 24px;
    background: var(--group-background-color, #fff);
  }

  .cb-section {
    grid-column: 1 / -1;
    margin: 8px 0 -8px;
    font: 600 11px/1.4 sans-serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b6d76;
    border-bottom: 1px solid #e5e6e7;
    padding-bottom: 6px;
  }

  .cb-cell {
    margin: 0;
  }

  /* overlays (popover / actions menu) are absolutely positioned off the card;
     reserve room so they don't collide with the row below. --tall fits the
     actions menu; --xtall fits the taller options dropdown. */
  .cb-cell--tall {
    min-height: 250px;
  }

  .cb-cell--xtall {
    min-height: 430px;
  }

  .cb-caption {
    margin-bottom: 6px;
    font: 12px/1.4 sans-serif;
    color: #6b6d76;
  }

  .cb-note {
    grid-column: 1 / -1;
    margin: 0;
    font: 12px/1.5 sans-serif;
    color: #6b6d76;
  }
`);

// a translate that mirrors the properties-panel signature: `{key}` interpolation
function translate(template, replacements = {}) {
  return template.replace(/{([^}]+)}/g, (_, key) =>
    replacements[key] != null ? replacements[key] : '{' + key + '}'
  );
}

function noop() {}

// a tiny inline logo so the "selected" card shows an icon rather than an initial
const ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
  '<rect width="28" height="28" rx="6" fill="#4b5bd6"/>' +
  '<circle cx="14" cy="14" r="7" fill="#fff"/>' +
  '</svg>'
);

const INSTANCE = {
  name: 'myConnection',
  metadata: { displayName: 'My Connection' }
};

const INSTANCE_WITH_ICON = {
  name: 'slackProd',
  metadata: { displayName: 'Slack (Production)' },
  icon: ICON
};

// a set of options for the dropdown/popover
const INSTANCES = [
  { name: 'slackProd', metadata: { displayName: 'Slack (Production)' }, icon: ICON },
  { name: 'slackDev', metadata: { displayName: 'Slack (Development)' } },
  { name: 'myConnection', metadata: { displayName: 'My Connection' } },
  { name: 'githubMain', metadata: { displayName: 'GitHub (Main)' } }
];

// shared handlers/flags every interactive/menu card needs
const CARD = {
  translate,
  onMenu: noop,
  menuOpen: false,
  disabled: false
};

// wraps a card in the real entry markup so severity (.has-warning / .has-error)
// and the chooser control layout resolve exactly as they do in the panel
function Cell(props) {
  const {
    label,
    severity = '',
    state = 'selected',
    tall = false,
    xtall = false,
    status = null,
    error = null,
    description = null,
    children
  } = props;

  const entryClass = [
    'bio-properties-panel-entry',
    'bio-properties-panel-configuration-chooser',
    severity
  ].filter(Boolean).join(' ');

  const cellClass = [
    'cb-cell',
    tall ? 'cb-cell--tall' : '',
    xtall ? 'cb-cell--xtall' : ''
  ].filter(Boolean).join(' ');

  return (
    <figure class={ cellClass }>
      <figcaption class="cb-caption">{ label }</figcaption>
      <div class={ entryClass } data-configuration-state={ state }>
        <label class="bio-properties-panel-label">Connection</label>
        <div class="bio-properties-panel-configuration-chooser-control">
          { children }
        </div>

        {
          status
            ? <div class={ 'bio-properties-panel-' + (status.severity === 'warning' ? 'warning' : 'description') }>{ status.message }</div>
            : null
        }

        {
          error
            ? <div class="bio-properties-panel-error">{ error }</div>
            : null
        }

        {
          description
            ? <div class="bio-properties-panel-description">{ description }</div>
            : null
        }
      </div>
    </figure>
  );
}

function StatesSection() {
  return (
    <>
      <div class="cb-section">States</div>

      <Cell label="Placeholder — no selection" state="placeholder">
        <PlaceholderConfiguration
          id="cb-placeholder"
          controlId="cb-placeholder-control"
          listboxId="cb-placeholder-listbox"
          chooserLabel="connection"
          available={ true }
          disabled={ false }
          error={ null }
          open={ false }
          onClick={ noop }
          translate={ translate } />
      </Cell>

      <Cell label="Placeholder — unavailable" state="placeholder"
        status={ { severity: 'note', message: 'No cluster connected' } }>
        <PlaceholderConfiguration
          id="cb-placeholder-off"
          controlId="cb-placeholder-off-control"
          listboxId="cb-placeholder-off-listbox"
          chooserLabel="connection"
          available={ false }
          disabled={ false }
          error={ null }
          open={ false }
          onClick={ noop }
          translate={ translate } />
      </Cell>

      <Cell label="Loading" state="loading">
        <LoadingConfiguration
          value="=camunda.vars.env.myConnection"
          cachedName="My Connection" />
      </Cell>

      <Cell label="Selected — with icon" state="selected">
        <SelectedConfiguration
          controlId="cb-selected-control"
          listboxId="cb-selected-listbox"
          menuId="cb-selected-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE_WITH_ICON }
          { ...CARD } />
      </Cell>

      <Cell label="Selected — initial fallback" state="selected">
        <SelectedConfiguration
          controlId="cb-selected2-control"
          listboxId="cb-selected2-listbox"
          menuId="cb-selected2-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE }
          { ...CARD } />
      </Cell>

      <Cell label="Offline — cached, unreachable" state="selected">
        <OfflineConfiguration
          menuId="cb-offline-menu"
          value="=camunda.vars.env.slackProd"
          cachedName="Slack (Production)"
          icon={ ICON }
          { ...CARD } />
      </Cell>

      <Cell label="Missing — reference not found" state="missing" severity="has-warning"
        status={ { severity: 'warning', message: 'Not found on cluster' } }>
        <MissingConfiguration
          controlId="cb-missing-control"
          listboxId="cb-missing-listbox"
          menuId="cb-missing-menu"
          open={ false }
          onClick={ noop }
          value="=camunda.vars.env.oldConnection"
          cachedName="Old Connection"
          instance={ null }
          { ...CARD } />
      </Cell>

      <Cell label="Error — configurations could not be loaded" state="missing" severity="has-warning"
        status={ { severity: 'warning', message: 'Could not load configurations' } }>
        <ErrorConfiguration
          menuId="cb-error-menu"
          value="=camunda.vars.env.brokenRef"
          cachedName="Broken Connection"
          { ...CARD } />
      </Cell>
    </>
  );
}

function SeveritySection() {
  return (
    <>
      <div class="cb-section">Severity on a data card</div>

      <Cell label="Neutral" state="selected">
        <SelectedConfiguration
          controlId="cb-sev-neutral-control"
          listboxId="cb-sev-neutral-listbox"
          menuId="cb-sev-neutral-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE }
          { ...CARD } />
      </Cell>

      <Cell label="has-warning" state="selected" severity="has-warning">
        <SelectedConfiguration
          controlId="cb-sev-warning-control"
          listboxId="cb-sev-warning-listbox"
          menuId="cb-sev-warning-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE }
          { ...CARD } />
      </Cell>

      <Cell label="has-error" state="selected" severity="has-error">
        <SelectedConfiguration
          controlId="cb-sev-error-control"
          listboxId="cb-sev-error-listbox"
          menuId="cb-sev-error-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE }
          { ...CARD } />
      </Cell>

      <p class="cb-note">
        Hover and keyboard-focus (Tab) the cards to inspect the interactive
        states: grey mouse-over on interactive cards, blue focus fill + focus
        ring on the data cards, and the standalone <code>…</code> menu button.
      </p>
    </>
  );
}

function MessagesSection() {
  return (
    <>
      <div class="cb-section">Description &amp; validation messages</div>

      <Cell
        label="Selected + description"
        state="selected"
        description="Connection used to authenticate the task.">
        <SelectedConfiguration
          controlId="cb-desc-control"
          listboxId="cb-desc-listbox"
          menuId="cb-desc-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE_WITH_ICON }
          { ...CARD } />
      </Cell>

      <Cell
        label="Selected + validation error"
        state="selected"
        severity="has-error"
        error="Connection is required."
        description="Connection used to authenticate the task.">
        <SelectedConfiguration
          controlId="cb-err-control"
          listboxId="cb-err-listbox"
          menuId="cb-err-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE }
          { ...CARD } />
      </Cell>

      <Cell
        label="Missing + warning status + description"
        state="missing"
        severity="has-warning"
        status={ { severity: 'warning', message: 'Referenced connection was not found in the cluster.' } }
        description="Connection used to authenticate the task.">
        <MissingConfiguration
          controlId="cb-missdesc-control"
          listboxId="cb-missdesc-listbox"
          menuId="cb-missdesc-menu"
          open={ false }
          onClick={ noop }
          value="=camunda.vars.env.oldConnection"
          cachedName="Old Connection"
          instance={ null }
          { ...CARD } />
      </Cell>

      <Cell
        label="Placeholder + validation error"
        state="placeholder"
        severity="has-error"
        error="Connection is required.">
        <PlaceholderConfiguration
          id="cb-pherr"
          controlId="cb-pherr-control"
          listboxId="cb-pherr-listbox"
          chooserLabel="connection"
          available={ true }
          disabled={ false }
          error={ null }
          open={ false }
          onClick={ noop }
          translate={ translate } />
      </Cell>

      <Cell
        label="Placeholder + validation error + description"
        state="placeholder"
        severity="has-error"
        error="Connection is required."
        description="Connection used to authenticate the task.">
        <PlaceholderConfiguration
          id="cb-pherrdesc"
          controlId="cb-pherrdesc-control"
          listboxId="cb-pherrdesc-listbox"
          chooserLabel="connection"
          available={ true }
          disabled={ false }
          error={ null }
          open={ false }
          onClick={ noop }
          translate={ translate } />
      </Cell>
    </>
  );
}

function ActionsMenuSection() {
  return (
    <>
      <div class="cb-section">Actions menu (open)</div>

      <Cell label="Menu — edit / upgrade / unset" state="selected" tall={ true }>
        <SelectedConfiguration
          controlId="cb-menufull-control"
          listboxId="cb-menufull-listbox"
          menuId="cb-menufull-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE_WITH_ICON }
          { ...CARD }
          menuOpen={ true } />
        <ConfigurationContextMenu
          menuId="cb-menufull-menu"
          initialFocus={ null }
          onEdit={ noop }
          onUpgrade={ noop }
          onRemove={ noop }
          onClose={ noop }
          onDismiss={ noop }
          translate={ translate } />
      </Cell>

      <Cell label="Menu — unset only" state="missing" severity="has-warning" tall={ true }>
        <MissingConfiguration
          controlId="cb-menumin-control"
          listboxId="cb-menumin-listbox"
          menuId="cb-menumin-menu"
          open={ false }
          onClick={ noop }
          value="=camunda.vars.env.oldConnection"
          cachedName="Old Connection"
          instance={ null }
          { ...CARD }
          menuOpen={ true } />
        <ConfigurationContextMenu
          menuId="cb-menumin-menu"
          initialFocus={ null }
          onEdit={ null }
          onUpgrade={ null }
          onRemove={ noop }
          onClose={ noop }
          onDismiss={ noop }
          translate={ translate } />
      </Cell>

      <Cell
        label="Menu — with description"
        state="selected"
        tall={ true }
        description="Connection used to authenticate the task.">
        <SelectedConfiguration
          controlId="cb-menudesc-control"
          listboxId="cb-menudesc-listbox"
          menuId="cb-menudesc-menu"
          open={ false }
          onClick={ noop }
          instance={ INSTANCE_WITH_ICON }
          { ...CARD }
          menuOpen={ true } />
        <ConfigurationContextMenu
          menuId="cb-menudesc-menu"
          initialFocus={ null }
          onEdit={ noop }
          onUpgrade={ noop }
          onRemove={ noop }
          onClose={ noop }
          onDismiss={ noop }
          translate={ translate } />
      </Cell>
    </>
  );
}

function DropdownSection() {
  return (
    <>
      <div class="cb-section">Dropdown (open)</div>

      <Cell label="Dropdown — options + create" state="placeholder" xtall={ true }>
        <PlaceholderConfiguration
          id="cb-dd"
          controlId="cb-dd-control"
          listboxId="cb-dd-listbox"
          chooserLabel="connection"
          available={ true }
          disabled={ false }
          error={ null }
          open={ true }
          onClick={ noop }
          translate={ translate } />
        <ConfigurationPopover
          listboxId="cb-dd-listbox"
          instances={ INSTANCES }
          selected={ INSTANCES[1] }
          canCreate={ true }
          onCreate={ noop }
          onSelect={ noop }
          onClose={ noop }
          onDismiss={ noop }
          loading={ false }
          translate={ translate } />
      </Cell>

      <Cell label="Dropdown — refreshing" state="placeholder" xtall={ true }>
        <PlaceholderConfiguration
          id="cb-ddload"
          controlId="cb-ddload-control"
          listboxId="cb-ddload-listbox"
          chooserLabel="connection"
          available={ true }
          disabled={ false }
          error={ null }
          open={ true }
          onClick={ noop }
          translate={ translate } />
        <ConfigurationPopover
          listboxId="cb-ddload-listbox"
          instances={ INSTANCES }
          selected={ null }
          canCreate={ true }
          onCreate={ noop }
          onSelect={ noop }
          onClose={ noop }
          onDismiss={ noop }
          loading={ true }
          translate={ translate } />
      </Cell>

      <Cell label="Dropdown — empty" state="placeholder" xtall={ true }>
        <PlaceholderConfiguration
          id="cb-ddempty"
          controlId="cb-ddempty-control"
          listboxId="cb-ddempty-listbox"
          chooserLabel="connection"
          available={ true }
          disabled={ false }
          error={ null }
          open={ true }
          onClick={ noop }
          translate={ translate } />
        <ConfigurationPopover
          listboxId="cb-ddempty-listbox"
          instances={ [] }
          selected={ null }
          canCreate={ true }
          onCreate={ noop }
          onSelect={ noop }
          onClose={ noop }
          onDismiss={ noop }
          loading={ false }
          translate={ translate } />
      </Cell>

      <Cell
        label="Dropdown — with description"
        state="selected"
        xtall={ true }
        description="Connection used to authenticate the task.">
        <SelectedConfiguration
          controlId="cb-ddsel-control"
          listboxId="cb-ddsel-listbox"
          menuId="cb-ddsel-menu"
          open={ true }
          onClick={ noop }
          instance={ INSTANCE_WITH_ICON }
          { ...CARD } />
        <ConfigurationPopover
          listboxId="cb-ddsel-listbox"
          instances={ INSTANCES }
          selected={ INSTANCES[0] }
          canCreate={ true }
          onCreate={ noop }
          onSelect={ noop }
          onClose={ noop }
          onDismiss={ noop }
          loading={ false }
          translate={ translate } />
      </Cell>
    </>
  );
}

// renders one section into the test's own container, wrapped in the panel +
// board chrome. Each `it` gets a fresh container, so a single `it.only` shows
// just that section (no scrolling) while running the whole suite stacks them.
function renderSection(ctx, section) {
  const container = TestContainer.get(ctx);

  // TestContainer.get returns the inner content element; the element that clips
  // (fixed height + overflow:hidden) is the outer .test-container. Mark that one
  // so our stylesheet lets it grow and tall sections are not cut off.
  const testContainer = container.closest('.test-container') || container;
  testContainer.classList.add('cb-test-container');

  render(
    <div class="bio-properties-panel">
      <div class="cb-board">
        { section }
      </div>
    </div>,
    container
  );
}

// Visual, human-only test bed. It does not assert; it renders the chooser
// variations so the styling can be reviewed and discussed. Run it in isolation
// with `SINGLE_START=chooser npm run dev` (or `npm run start:chooser`); it is
// skipped in the regular headless suite.
//
// Focus a single section (renders without scrolling) by changing its `it` below
// to `it.only`; leave them all to stack every section down the page.
(singleStart === 'chooser' ? describe.only : describe.skip)('configuration chooser (visual)', function() {

  it('states', function() {
    renderSection(this, <StatesSection />);
  });

  it('severity on a data card', function() {
    renderSection(this, <SeveritySection />);
  });

  it('description & validation messages', function() {
    renderSection(this, <MessagesSection />);
  });

  it('actions menu (open)', function() {
    renderSection(this, <ActionsMenuSection />);
  });

  it('dropdown (open)', function() {
    renderSection(this, <DropdownSection />);
  });

});
