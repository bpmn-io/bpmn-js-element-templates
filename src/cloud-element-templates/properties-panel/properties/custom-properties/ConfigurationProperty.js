import { useService } from 'bpmn-js-properties-panel';
import { useCallback, useEffect, useMemo, useRef, useState } from '@bpmn-io/properties-panel/preact/hooks';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { query as domQuery } from 'min-dom';

import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { propertyGetter, propertySetter } from './util';

import { findExtension, findInputParameter } from '../../../Helper';

/**
 * FEEL expression referencing a connection instance as a cluster variable.
 *
 * @param {string} name
 * @returns {string}
 */
function toReference(name) {
  return `=camunda.vars.env.${ name }`;
}

/**
 * Connection chooser.
 *
 * Renders a bespoke picker (NOT a plain select): a dashed placeholder that
 * opens a popover listing the connection instances compatible with the
 * property's `templateRef`. Once chosen, the connection is shown as a card.
 * The stored value is a FEEL expression referencing the chosen connection as a
 * cluster variable (`=camunda.vars.env.<name>`); clearing the selection
 * removes the binding.
 */
export function ConfigurationProperty(props) {
  const {
    element,
    id,
    property
  } = props;

  const {
    description,
    editable,
    label,
    tooltip,
    configurationTemplate,
    configurationTemplateVersion,
    templateRef: _templateRef,
    schemaRef,
    templateVersion: _templateVersion
  } = property;

  const templateRef = configurationTemplate || _templateRef || schemaRef;
  const templateVersion = configurationTemplateVersion != null ? configurationTemplateVersion : _templateVersion;

  const disabled = editable === false;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        translate = useService('translate'),
        eventBus = useService('eventBus'),
        configurationInstances = useService('configurationInstances');

  // re-render when available instances change
  const [ result, setResult ] = useState(
    configurationInstances.getByTemplateRef(templateRef, templateVersion)
  );

  const [ loaded, setLoaded ] = useState(configurationInstances.isLoaded());

  useEffect(() => {
    const callback = () => {
      setResult(configurationInstances.getByTemplateRef(templateRef, templateVersion));
      setLoaded(configurationInstances.isLoaded());
    };

    eventBus.on('configurationInstances.changed', callback);
    callback();

    return () => {
      eventBus.off('configurationInstances.changed', callback);
    };
  }, [ eventBus, configurationInstances, templateRef, templateVersion ]);

  const instances = result.compatible;
  const incompatible = result.incompatible;

  const getValue = useMemo(
    () => propertyGetter(element, property),
    [ element, property ]
  );

  const baseSetValue = useMemo(
    () => propertySetter(bpmnFactory, commandStack, element, property),
    [ bpmnFactory, commandStack, element, property ]
  );

  // Wrap setter to stamp connection metadata on the zeebe:input
  const setValue = useCallback((value) => {
    baseSetValue(value);

    // After the generic setter creates/updates the input, stamp the attributes
    if (property.binding && property.binding.type === 'zeebe:input') {
      const businessObject = getBusinessObject(element);
      const extensionElements = businessObject.get('extensionElements');

      if (extensionElements) {
        const ioMapping = findExtension(extensionElements, 'zeebe:IoMapping');

        if (ioMapping) {
          const input = findInputParameter(ioMapping, property.binding);

          if (input) {
            const selectedInstance = instances.find(({ name }) => toReference(name) === value);
            const properties = {};

            if (templateRef) {
              properties.modelerConfigurationTemplate = templateRef;
            }

            if (selectedInstance) {
              properties.modelerConfigurationName = selectedInstance.displayName || selectedInstance.name;
            } else {

              // Clearing selection — remove cached metadata
              properties.modelerConfigurationName = undefined;
            }

            commandStack.execute('element.updateModdleProperties', {
              element,
              moddleElement: input,
              properties
            });
          }
        }
      }
    }
  }, [ baseSetValue, element, property, templateRef, instances, commandStack ]);

  const value = getValue();
  const selected = instances.find(({ name }) => toReference(name) === value);

  // Read cached connection metadata from the zeebe:input element
  const cachedName = useMemo(() => {
    if (!value || !property.binding || property.binding.type !== 'zeebe:input') {
      return null;
    }

    const businessObject = getBusinessObject(element);
    const extensionElements = businessObject.get('extensionElements');

    if (!extensionElements) return null;

    const ioMapping = findExtension(extensionElements, 'zeebe:IoMapping');

    if (!ioMapping) return null;

    const input = findInputParameter(ioMapping, property.binding);

    return input && input.modelerConfigurationName;
  }, [ element, property, value ]);

  const [ open, setOpen ] = useState(false);
  const [ menuOpen, setMenuOpen ] = useState(false);
  const ref = useRef(null);

  // close popover/menu on outside click
  useEffect(() => {
    if (!open && !menuOpen) {
      return;
    }

    const onDocPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocPointer, true);

    return () => {
      document.removeEventListener('mousedown', onDocPointer, true);
    };
  }, [ open, menuOpen ]);

  const select = useCallback((name) => {
    if (disabled) {
      return;
    }

    setValue(name ? toReference(name) : '');
    setOpen(false);
    setMenuOpen(false);
  }, [ disabled, setValue ]);

  const toggleOpen = useCallback(() => {
    if (disabled) {
      return;
    }

    setMenuOpen(false);
    setOpen(value => !value);
  }, [ disabled ]);

  const toggleMenu = useCallback((event) => {
    if (disabled) {
      return;
    }

    event.stopPropagation();
    setOpen(false);
    setMenuOpen(value => !value);
  }, [ disabled ]);

  return (
    <div
      ref={ ref }
      class="bio-properties-panel-connection-chooser"
      data-entry-id={ id }>
      <label class="bio-properties-panel-label">
        { translate(label) }
      </label>

      {
        description
          ? <PropertyDescription description={ description } />
          : null
      }

      {
        tooltip
          ? <PropertyTooltip tooltip={ tooltip } />
          : null
      }

      {
        selected
          ? (
            <SelectedConnection
              instance={ selected }
              disabled={ disabled }
              menuOpen={ menuOpen }
              onClick={ toggleOpen }
              onMenu={ toggleMenu }
              translate={ translate } />
          )
          : value && !loaded
            ? (
              <LoadingConnection cachedName={ cachedName } translate={ translate } />
            )
            : value && loaded && !selected
              ? (
                <MissingConnection
                  value={ value }
                  cachedName={ cachedName }
                  disabled={ disabled }
                  menuOpen={ menuOpen }
                  onClick={ toggleOpen }
                  onMenu={ toggleMenu }
                  translate={ translate } />
              )
              : (
                <button
                  type="button"
                  class="bio-properties-panel-connection-chooser-placeholder"
                  disabled={ disabled }
                  aria-expanded={ open }
                  onClick={ toggleOpen }>
                  <span class="bio-properties-panel-connection-chooser-placeholder-plus">+</span>
                  { translate('Select connection') }
                </button>
              )
      }

      {
        open
          ? (
            <ConnectionPopover
              instances={ instances }
              incompatible={ incompatible }
              selected={ selected }
              onSelect={ select }
              templateVersion={ templateVersion }
              translate={ translate } />
          )
          : null
      }

      {
        menuOpen
          ? (
            <ConnectionContextMenu
              onGoTo={ () => { setMenuOpen(false); } }
              onRemove={ () => select(null) }
              translate={ translate } />
          )
          : null
      }
    </div>
  );
}

function SelectedConnection(props) {
  const {
    disabled,
    instance,
    menuOpen,
    onClick,
    onMenu,
    translate
  } = props;

  return (
    <div
      class="bio-properties-panel-connection-chooser-selected"
      role="button"
      tabIndex={ disabled ? -1 : 0 }
      onClick={ disabled ? null : onClick }
      onKeyDown={ disabled ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } }>
      <ConnectionLogo instance={ instance } />
      <span class="bio-properties-panel-connection-chooser-text">
        <span class="bio-properties-panel-connection-chooser-title">
          { instance.displayName || instance.name }
        </span>
        <span class="bio-properties-panel-connection-chooser-subtitle">
          { instance.authType ? `${ instance.authType } · ` : null }
          <span class="bio-properties-panel-connection-chooser-varname">{ instance.name }</span>
        </span>
      </span>
      <ConnectionStatus status={ instance.status } translate={ translate } />
      <button
        type="button"
        class="bio-properties-panel-connection-chooser-menu"
        title={ translate('More actions') }
        aria-label={ translate('More actions') }
        aria-expanded={ menuOpen }
        disabled={ disabled }
        onClick={ onMenu }>
        …
      </button>
    </div>
  );
}

function ConnectionContextMenu(props) {
  const { onGoTo, onRemove, translate } = props;

  return (
    <div class="bio-properties-panel-connection-chooser-context-menu">
      <button
        type="button"
        class="bio-properties-panel-connection-chooser-context-menu-item"
        onClick={ onGoTo }>
        { translate('Go to connection') }
      </button>
      <button
        type="button"
        class="bio-properties-panel-connection-chooser-context-menu-item bio-properties-panel-connection-chooser-context-menu-item--danger"
        onClick={ onRemove }>
        { translate('Remove') }
      </button>
    </div>
  );
}

function LoadingConnection(props) {
  const { cachedName, translate } = props;

  return (
    <div class="bio-properties-panel-connection-chooser-loading">
      <span class="bio-properties-panel-connection-chooser-loading-shimmer" />
      <span class="bio-properties-panel-connection-chooser-text">
        <span class="bio-properties-panel-connection-chooser-title">
          { cachedName || translate('Loading connection…') }
        </span>
        { cachedName
          ? <span class="bio-properties-panel-connection-chooser-subtitle">
              { translate('Validating…') }
            </span>
          : null
        }
      </span>
    </div>
  );
}

function MissingConnection(props) {
  const {
    cachedName,
    disabled,
    menuOpen,
    onClick,
    onMenu,
    translate,
    value
  } = props;

  // extract variable name from FEEL expression
  const refName = value.startsWith('=camunda.vars.env.')
    ? value.slice('=camunda.vars.env.'.length)
    : value;

  return (
    <div
      class="bio-properties-panel-connection-chooser-missing"
      role="button"
      tabIndex={ disabled ? -1 : 0 }
      onClick={ disabled ? null : onClick }
      onKeyDown={ disabled ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } }>
      <span class="bio-properties-panel-connection-chooser-missing-icon">⚠</span>
      <span class="bio-properties-panel-connection-chooser-text">
        <span class="bio-properties-panel-connection-chooser-title">
          { cachedName || translate('Connection not found') }
        </span>
        <span class="bio-properties-panel-connection-chooser-subtitle">
          { cachedName ? translate('Not found on cluster') : refName }
        </span>
      </span>
      <button
        type="button"
        class="bio-properties-panel-connection-chooser-menu"
        title={ translate('More actions') }
        aria-label={ translate('More actions') }
        aria-expanded={ menuOpen }
        disabled={ disabled }
        onClick={ onMenu }>
        …
      </button>
    </div>
  );
}

function ConnectionPopover(props) {
  const {
    incompatible = [],
    instances,
    onSelect,
    selected,
    templateVersion,
    translate
  } = props;

  return (
    <div class="bio-properties-panel-connection-chooser-popover">
      <div class="bio-properties-panel-connection-chooser-popover-header">
        { translate('Available connections') }
      </div>

      {
        instances.length
          ? (
            <ul class="bio-properties-panel-connection-chooser-popover-list">
              {
                instances.map((instance) => (
                  <ConnectionRow
                    key={ instance.name }
                    instance={ instance }
                    selected={ selected === instance }
                    onSelect={ () => onSelect(selected === instance ? null : instance.name) }
                    translate={ translate } />
                ))
              }
            </ul>
          )
          : (
            <div class="bio-properties-panel-connection-chooser-empty">
              { translate('No compatible connections available.') }
            </div>
          )
      }

      {
        incompatible.length
          ? (
            <div class="bio-properties-panel-connection-chooser-popover-section">
              <div class="bio-properties-panel-connection-chooser-popover-header">
                { translate('Needs upgrade') }
                { templateVersion != null
                  ? <span class="bio-properties-panel-connection-chooser-popover-hint">
                      { translate('Requires v') }{ templateVersion }{ translate('+') }
                    </span>
                  : null
                }
              </div>
              <ul class="bio-properties-panel-connection-chooser-popover-list">
                {
                  incompatible.map((instance) => (
                    <ConnectionRow
                      key={ instance.name }
                      instance={ instance }
                      blocked
                      translate={ translate } />
                  ))
                }
              </ul>
            </div>
          )
          : null
      }

      <button
        type="button"
        class="bio-properties-panel-connection-chooser-create"
        onClick={ () => onSelect(null) }>
        <span class="bio-properties-panel-connection-chooser-placeholder-plus">+</span>
        { translate('Create connection') }
      </button>
    </div>
  );
}

function ConnectionRow(props) {
  const {
    blocked,
    instance,
    onSelect,
    selected,
    translate
  } = props;

  const subtitleParts = [ instance.type, instance.authType ].filter(Boolean);
  const meta = subtitleParts.join(' · ');

  const version = instance.configurationTemplateVersion != null ? instance.configurationTemplateVersion : instance.version;
  const versionSuffix = blocked && version != null ? ` (v${ version })` : '';

  const onKeyDown = (event) => {
    if (blocked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  const classes = [ 'bio-properties-panel-connection-chooser-popover-row' ];

  if (selected) {
    classes.push('bio-properties-panel-connection-chooser-popover-row--selected');
  }

  if (blocked) {
    classes.push('bio-properties-panel-connection-chooser-popover-row--blocked');
  }

  return (
    <li
      class={ classes.join(' ') }
      role="button"
      tabIndex={ blocked ? -1 : 0 }
      aria-pressed={ selected }
      aria-disabled={ blocked }
      onClick={ blocked ? null : onSelect }
      onKeyDown={ onKeyDown }
      title={ blocked ? translate('Connection needs upgrade') : null }>
      <ConnectionLogo instance={ instance } />
      <span class="bio-properties-panel-connection-chooser-text">
        <span class="bio-properties-panel-connection-chooser-title">
          { instance.displayName || instance.name }
        </span>
        <span class="bio-properties-panel-connection-chooser-subtitle">
          { meta ? `${ meta } · ` : null }
          <span class="bio-properties-panel-connection-chooser-varname">{ instance.name }</span>
          { versionSuffix }
        </span>
      </span>
      { blocked
        ? <span class="bio-properties-panel-connection-chooser-blocked-badge">{ translate('upgrade needed') }</span>
        : <ConnectionStatus status={ instance.status } translate={ translate } />
      }
    </li>
  );
}

function ConnectionLogo(props) {
  const { instance } = props;

  if (instance.icon) {
    return (
      <img
        class="bio-properties-panel-connection-chooser-logo"
        src={ instance.icon }
        alt="" />
    );
  }

  const initial = (instance.displayName || instance.name || '?').charAt(0).toUpperCase();

  return (
    <span class="bio-properties-panel-connection-chooser-logo bio-properties-panel-connection-chooser-logo--placeholder">
      { initial }
    </span>
  );
}

function ConnectionStatus(props) {
  const { status, translate } = props;

  if (!status) {
    return null;
  }

  const classes = [
    'bio-properties-panel-connection-chooser-badge',
    `bio-properties-panel-connection-chooser-badge--${ status }`
  ];

  return (
    <span class={ classes.join(' ') }>
      { translate(status) }
    </span>
  );
}

/**
 * Whether the connection chooser has a non-empty selection.
 *
 * @param {HTMLElement} node
 * @returns {boolean}
 */
export function isConnectionChooserEdited(node) {
  return !!domQuery('.bio-properties-panel-connection-chooser-selected', node);
}
