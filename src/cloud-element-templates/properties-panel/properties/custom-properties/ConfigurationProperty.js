import { useService } from 'bpmn-js-properties-panel';

import { useCallback, useEffect, useMemo, useRef, useState } from '@bpmn-io/properties-panel/preact/hooks';
import { CreateIcon } from '@bpmn-io/properties-panel';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { query as domQuery } from 'min-dom';

import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { propertyGetter, propertySetter } from './util';

import { findExtension, findInputParameter, findZeebeProperty } from '../../../Helper';

/**
 * FEEL expression referencing a configuration instance as a cluster variable.
 *
 * @param {string} name
 * @returns {string}
 */
function toReference(name) {
  return `=camunda.vars.env.${ name }`;
}

function fromReference(value) {
  const prefix = '=camunda.vars.env.';

  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function getDisplayName(instance) {
  return instance.metadata?.displayName || instance.name;
}

function toSentenceFragment(value) {
  return /^[A-Z][a-z]/.test(value)
    ? value.charAt(0).toLowerCase() + value.slice(1)
    : value;
}

function getBindingElement(extensionElements, binding) {
  if (binding.type === 'zeebe:input') {
    const ioMapping = findExtension(extensionElements, 'zeebe:IoMapping');

    return ioMapping && findInputParameter(ioMapping, binding);
  }

  if (binding.type === 'zeebe:property') {
    const zeebeProperties = findExtension(extensionElements, 'zeebe:Properties');

    return zeebeProperties && findZeebeProperty(zeebeProperties, binding);
  }
}

/**
 * Configuration chooser.
 *
 * Renders a bespoke picker (NOT a plain select): a dashed placeholder that
 * opens a popover listing the configuration instances compatible with the
 * property's `configurationTemplate`. Once chosen, the configuration is shown as a card.
 * The stored value is a FEEL expression referencing the chosen configuration as a
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
    configurationTemplateVersion
  } = property;

  const minimumConfigurationTemplateVersion = configurationTemplateVersion;

  const disabled = editable === false;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        translate = useService('translate'),
        eventBus = useService('eventBus'),
        configurationTemplates = useService('configurationTemplates'),
        configurationInstances = useService('configurationInstances');

  const configurationTemplateDefinition = configurationTemplates.get(configurationTemplate, configurationTemplateVersion)
    || configurationTemplates.get(configurationTemplate);
  const templateName = configurationTemplateDefinition?.name;
  const configurationLabel = translate(label || templateName || 'Configuration');
  const chooserLabel = label ? toSentenceFragment(configurationLabel) : configurationLabel;

  // re-render when available instances change
  const [ result, setResult ] = useState(
    configurationInstances.getSelectableByConfigurationTemplate(configurationTemplate, minimumConfigurationTemplateVersion)
  );
  const [ loading, setLoading ] = useState(configurationInstances.isLoading());
  const [ error, setError ] = useState(configurationInstances.hasError());
  const [ available, setAvailable ] = useState(configurationInstances.isAvailable());
  const [ unavailableMessage, setUnavailableMessage ] = useState(configurationInstances.getUnavailableMessage());
  const [ canCreate, setCanCreate ] = useState(configurationInstances.canCreate());
  const [ canUpdate, setCanUpdate ] = useState(configurationInstances.canUpdate());

  useEffect(() => {
    const onChanged = () => {
      setResult(configurationInstances.getSelectableByConfigurationTemplate(configurationTemplate, minimumConfigurationTemplateVersion));
      setLoading(configurationInstances.isLoading());
      setError(configurationInstances.hasError());
      setAvailable(configurationInstances.isAvailable());
      setUnavailableMessage(configurationInstances.getUnavailableMessage());
      setCanCreate(configurationInstances.canCreate());
      setCanUpdate(configurationInstances.canUpdate());
    };

    eventBus.on('configurationInstances.changed', onChanged);
    onChanged();

    return () => {
      eventBus.off('configurationInstances.changed', onChanged);
    };
  }, [ eventBus, configurationInstances, configurationTemplate, minimumConfigurationTemplateVersion ]);

  const instances = result;

  const getValue = useMemo(
    () => propertyGetter(element, property),
    [ element, property ]
  );

  const baseSetValue = useMemo(
    () => propertySetter(bpmnFactory, commandStack, element, property),
    [ bpmnFactory, commandStack, element, property ]
  );

  // Wrap setter to stamp configuration metadata on the BPMN binding.
  const setValue = useCallback((value, instance) => {
    const selectedInstance = instance || instances.find(({ name }) => toReference(name) === value);

    baseSetValue(value, {
      modelerConfigurationTemplate: value && configurationTemplate || undefined,
      modelerConfigurationName: selectedInstance ? getDisplayName(selectedInstance) : undefined
    });
  }, [ baseSetValue, configurationTemplate, instances ]);

  const value = getValue();
  const selected = instances.find(({ name }) => toReference(name) === value);
  const boundInstance = value ? configurationInstances.getReferencedInstanceByName(fromReference(value)) : null;
  const boundMetadata = boundInstance?.metadata || {};
  const typeIncompatible = !!boundInstance
    && boundMetadata.configurationTemplate !== configurationTemplate;
  const versionIncompatible = !!boundInstance
    && boundMetadata.configurationTemplate === configurationTemplate
    && minimumConfigurationTemplateVersion != null
    && (boundMetadata.configurationTemplateVersion == null
      || boundMetadata.configurationTemplateVersion < minimumConfigurationTemplateVersion);
  const incompatible = typeIncompatible || versionIncompatible;

  // Read cached configuration metadata from the BPMN binding.
  const cachedName = useMemo(() => {
    if (!value || !property.binding) {
      return null;
    }

    const businessObject = getBusinessObject(element);
    const extensionElements = businessObject.get('extensionElements');

    if (!extensionElements) return null;

    const bindingElement = getBindingElement(extensionElements, property.binding);

    return bindingElement && bindingElement.modelerConfigurationName;
  }, [ element, property, value ]);

  const [ open, setOpen ] = useState(false);
  const [ menuOpen, setMenuOpen ] = useState(false);
  const ref = useRef(null);
  const availabilityRef = useRef({ error, available });

  useEffect(() => {
    const previousAvailability = availabilityRef.current;

    availabilityRef.current = { error, available };

    if (
      (!previousAvailability.error && error)
      || (previousAvailability.available && !available)
    ) {
      setOpen(false);
      setMenuOpen(false);
    }
  }, [ error, available ]);

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

    const instance = instances.find(instance => instance.name === name);

    setValue(name ? toReference(name) : '', instance);
    setOpen(false);
    setMenuOpen(false);
  }, [ disabled, instances, setValue ]);

  useEffect(() => {
    const onCreated = (event) => {
      if (!isSameChooser(event, element, property)) {
        return;
      }

      const { instance } = event;

      if (!instance || !configurationInstances.isCompatible(
        instance,
        configurationTemplate,
        minimumConfigurationTemplateVersion
      )) {
        return;
      }

      setValue(toReference(instance.name), instance);
      setOpen(false);
      setMenuOpen(false);
    };

    eventBus.on('configuration.created', onCreated);

    return () => {
      eventBus.off('configuration.created', onCreated);
    };
  }, [
    eventBus,
    element,
    property,
    configurationInstances,
    configurationTemplate,
    minimumConfigurationTemplateVersion,
    setValue
  ]);

  const createConfiguration = useCallback(() => {
    setOpen(false);

    eventBus.fire('configuration.create', {
      element,
      property,
      configurationTemplate,
      configurationTemplateVersion
    });
  }, [ eventBus, element, property, configurationTemplate, configurationTemplateVersion ]);

  const editConfiguration = useCallback(() => {
    setMenuOpen(false);

    eventBus.fire('configuration.edit', {
      element,
      property,
      instance: selected,
      configurationTemplate,
      configurationTemplateVersion
    });
  }, [ eventBus, element, property, selected, configurationTemplate, configurationTemplateVersion ]);

  const upgradeConfiguration = useCallback(() => {
    setMenuOpen(false);

    eventBus.fire('configuration.upgrade', {
      element,
      property,
      instance: boundInstance,
      configurationTemplate,
      configurationTemplateVersion
    });
  }, [ eventBus, element, property, boundInstance, configurationTemplate, configurationTemplateVersion ]);

  const toggleOpen = useCallback(() => {
    if (disabled || error || !available) {
      return;
    }

    setMenuOpen(false);
    setOpen(value => !value);
  }, [ disabled, error, available ]);

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
      class="bio-properties-panel-configuration-chooser"
      data-entry-id={ id }>
      <label class="bio-properties-panel-label">
        { configurationLabel }
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
        value && error
          ? (
            <ErrorConfiguration
              value={ value }
              cachedName={ cachedName }
              disabled={ disabled }
              menuOpen={ menuOpen }
              showMenu
              onMenu={ toggleMenu }
              translate={ translate } />
          )
          : selected
            ? (
              <SelectedConfiguration
                instance={ selected }
                disabled={ disabled }
                menuOpen={ menuOpen }
                showMenu={ canUpdate }
                onClick={ toggleOpen }
                onMenu={ toggleMenu }
                translate={ translate } />
            )
            : value && !selected && loading
              ? (
                <LoadingConfiguration cachedName={ cachedName } translate={ translate } />
              )
              : value && !selected && available
                ? (
                  <MissingConfiguration
                    value={ value }
                    cachedName={ cachedName }
                    instance={ incompatible ? boundInstance : null }
                    minimumVersion={ minimumConfigurationTemplateVersion }
                    typeIncompatible={ typeIncompatible }
                    disabled={ disabled }
                    menuOpen={ menuOpen }
                    showMenu={ versionIncompatible && canUpdate }
                    onClick={ toggleOpen }
                    onMenu={ toggleMenu }
                    translate={ translate } />
                )
                : value && !selected
                  ? (
                    <OfflineConfiguration
                      value={ value }
                      cachedName={ cachedName }
                      unavailableMessage={ unavailableMessage }
                      disabled={ disabled }
                      menuOpen={ menuOpen }
                      showMenu
                      icon={ configurationTemplates.get(configurationTemplate, configurationTemplateVersion)?.icon?.contents }
                      onMenu={ toggleMenu }
                      translate={ translate } />
                  )
                  : (
                    <>
                      <button
                        type="button"
                        class="bio-properties-panel-configuration-chooser-placeholder"
                        disabled={ disabled || error || !available }
                        aria-describedby={
                          error
                            ? `${ id }-error`
                            : !available && unavailableMessage
                              ? `${ id }-unavailable`
                              : undefined
                        }
                        aria-expanded={ open }
                        onClick={ toggleOpen }>
                        <CreateIcon
                          class="bio-properties-panel-configuration-chooser-create-icon"
                          aria-hidden="true" />
                        { translate('Choose {configuration}', { configuration: chooserLabel }) }
                      </button>
                      {
                        error
                          ? (
                            <div
                              id={ `${ id }-error` }
                              class="bio-properties-panel-configuration-chooser-unavailable bio-properties-panel-configuration-chooser-unavailable--error"
                              role="status">
                              { translate('Could not load configurations') }
                            </div>
                          )
                          : !available && unavailableMessage
                            ? (
                              <div
                                id={ `${ id }-unavailable` }
                                class="bio-properties-panel-configuration-chooser-unavailable"
                                role="status">
                                { unavailableMessage }
                              </div>
                            )
                            : null
                      }
                    </>
                  )
      }

      {
        open
          ? (
            <ConfigurationPopover
              instances={ instances }
              selected={ selected }
              hasSelection={ !!value }
              canCreate={ canCreate }
              onCreate={ createConfiguration }
              onSelect={ select }
              loading={ loading }
              translate={ translate } />
          )
          : null
      }

      {
        menuOpen
          ? (
            <ConfigurationContextMenu
              onEdit={ selected && canUpdate ? editConfiguration : null }
              onUpgrade={ versionIncompatible && canUpdate ? upgradeConfiguration : null }
              onClear={ error || !available ? () => select(null) : null }
              translate={ translate } />
          )
          : null
      }
    </div>
  );
}

function SelectedConfiguration(props) {
  const {
    disabled,
    instance,
    menuOpen,
    onClick,
    onMenu,
    showMenu,
    translate
  } = props;

  return (
    <div
      class="bio-properties-panel-configuration-chooser-selected"
      role="button"
      tabIndex={ disabled ? -1 : 0 }
      onClick={ disabled ? null : onClick }
      onKeyDown={ disabled ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } }>
      <ConfigurationLogo instance={ instance } />
      <span class="bio-properties-panel-configuration-chooser-text">
        <span class="bio-properties-panel-configuration-chooser-title">
          { getDisplayName(instance) }
        </span>
        <span class="bio-properties-panel-configuration-chooser-subtitle">
          <span class="bio-properties-panel-configuration-chooser-varname">{ instance.name }</span>
        </span>
      </span>
      {
        showMenu
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-menu"
              title={ translate('More actions') }
              aria-label={ translate('More actions') }
              aria-expanded={ menuOpen }
              disabled={ disabled }
              onClick={ onMenu }>
              …
            </button>
          )
          : null
      }
    </div>
  );
}

function ConfigurationContextMenu(props) {
  const { onClear, onEdit, onUpgrade, translate } = props;

  return (
    <div class="bio-properties-panel-configuration-chooser-context-menu">
      {
        onEdit
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-context-menu-item"
              onClick={ onEdit }>
              { translate('Edit') }
            </button>
          )
          : null
      }
      {
        onUpgrade
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-context-menu-item"
              onClick={ onUpgrade }>
              { translate('Upgrade') }
            </button>
          )
          : null
      }
      {
        onClear
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-context-menu-item"
              onClick={ onClear }>
              { translate('Clear selection') }
            </button>
          )
          : null
      }
    </div>
  );
}

function LoadingConfiguration(props) {
  const { cachedName, translate } = props;
  const name = cachedName || translate('Configuration');
  const instance = {
    name,
    metadata: {
      displayName: name
    }
  };

  return (
    <div
      class="bio-properties-panel-configuration-chooser-loading"
      role="status">
      <ConfigurationLogo instance={ instance } />
      <span class="bio-properties-panel-configuration-chooser-text">
        <span class="bio-properties-panel-configuration-chooser-title">
          { name }
        </span>
        <span class="bio-properties-panel-configuration-chooser-subtitle">
          { translate('Loading configuration') }
        </span>
      </span>
    </div>
  );
}

function ErrorConfiguration(props) {
  const {
    cachedName,
    disabled,
    menuOpen,
    onMenu,
    showMenu,
    translate,
    value
  } = props;

  const refName = fromReference(value);

  return (
    <div class="bio-properties-panel-configuration-chooser-missing bio-properties-panel-configuration-chooser-error">
      <ConfigurationLogo warning />
      <span class="bio-properties-panel-configuration-chooser-text">
        <span class="bio-properties-panel-configuration-chooser-title">
          { cachedName || refName }
        </span>
        <span class="bio-properties-panel-configuration-chooser-subtitle">
          { translate('Could not load configurations') }
        </span>
      </span>
      {
        showMenu
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-menu"
              title={ translate('More actions') }
              aria-label={ translate('More actions') }
              aria-expanded={ menuOpen }
              disabled={ disabled }
              onClick={ onMenu }>
              …
            </button>
          )
          : null
      }
    </div>
  );
}

function MissingConfiguration(props) {
  const {
    cachedName,
    disabled,
    instance,
    menuOpen,
    minimumVersion,
    onClick,
    onMenu,
    showMenu,
    translate,
    typeIncompatible,
    value
  } = props;

  // extract variable name from FEEL expression
  const refName = fromReference(value);
  const instanceVersion = instance?.metadata?.configurationTemplateVersion;

  return (
    <div
      class="bio-properties-panel-configuration-chooser-missing"
      role="button"
      tabIndex={ disabled ? -1 : 0 }
      onClick={ disabled ? null : onClick }
      onKeyDown={ disabled ? null : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } }>
      <ConfigurationLogo warning />
      <span class="bio-properties-panel-configuration-chooser-text">
        <span class="bio-properties-panel-configuration-chooser-title">
          {
            instance
              ? getDisplayName(instance)
              : cachedName || translate('Configuration not found')
          }
        </span>
        <span class="bio-properties-panel-configuration-chooser-subtitle">
          {
            instance
              ? typeIncompatible
                ? translate('Incompatible configuration type')
                : translate('Version {version} · Requires version {minimumVersion}+', {
                  version: instanceVersion == null ? '?' : instanceVersion,
                  minimumVersion
                })
              : cachedName ? translate('Not found on cluster') : refName
          }
        </span>
      </span>
      {
        showMenu
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-menu"
              title={ translate('More actions') }
              aria-label={ translate('More actions') }
              aria-expanded={ menuOpen }
              disabled={ disabled }
              onClick={ onMenu }>
              …
            </button>
          )
          : null
      }
    </div>
  );
}

function OfflineConfiguration(props) {
  const {
    cachedName,
    disabled,
    icon,
    menuOpen,
    onMenu,
    showMenu,
    translate,
    unavailableMessage,
    value
  } = props;

  const refName = fromReference(value);

  const instance = {
    name: refName,
    metadata: {
      displayName: cachedName
    },
    icon
  };

  return (
    <div
      class="bio-properties-panel-configuration-chooser-selected bio-properties-panel-configuration-chooser-selected--offline">
      <ConfigurationLogo instance={ instance } />
      <span class="bio-properties-panel-configuration-chooser-text">
        <span class="bio-properties-panel-configuration-chooser-title">
          { cachedName || refName }
        </span>
        <span class="bio-properties-panel-configuration-chooser-subtitle">
          { unavailableMessage || translate('Cluster unavailable') }
        </span>
      </span>
      {
        showMenu
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-menu"
              title={ translate('More actions') }
              aria-label={ translate('More actions') }
              aria-expanded={ menuOpen }
              disabled={ disabled }
              onClick={ onMenu }>
              …
            </button>
          )
          : null
      }
    </div>
  );
}

function ConfigurationPopover(props) {
  const {
    canCreate,
    hasSelection,
    instances,
    loading,
    onCreate,
    onSelect,
    selected,
    translate
  } = props;

  return (
    <div class="bio-properties-panel-configuration-chooser-popover">
      {
        loading
          ? (
            <span
              class="bio-properties-panel-configuration-chooser-refreshing"
              role="status">
              { translate('Refreshing configurations...') }
            </span>
          )
          : null
      }

      {
        instances.length || hasSelection
          ? (
            <ul class="bio-properties-panel-configuration-chooser-popover-list">
              {
                hasSelection
                  ? (
                    <EmptyConfigurationRow
                      onSelect={ () => onSelect(null) }
                      translate={ translate } />
                  )
                  : null
              }
              {
                instances.map((instance) => (
                  <ConfigurationRow
                    key={ instance.name }
                    instance={ instance }
                    selected={ selected === instance }
                    onSelect={ () => onSelect(selected === instance ? null : instance.name) }
                    translate={ translate } />
                ))
              }
              {
                !instances.length
                  ? (
                    <li class="bio-properties-panel-configuration-chooser-empty">
                      {
                        loading
                          ? translate('Loading...')
                          : translate('No compatible configurations are available in the connected cluster')
                      }
                    </li>
                  )
                  : null
              }
            </ul>
          )
          : (
            <div class="bio-properties-panel-configuration-chooser-empty">
              {
                loading
                  ? translate('Loading...')
                  : translate('No compatible configurations are available in the connected cluster')
              }
            </div>
          )
      }

      {
        canCreate
          ? (
            <button
              type="button"
              class="bio-properties-panel-configuration-chooser-create"
              onClick={ onCreate }>
              <CreateIcon
                class="bio-properties-panel-configuration-chooser-create-icon"
                aria-hidden="true" />
              { translate('Create') }
            </button>
          )
          : null
      }
    </div>
  );
}

function EmptyConfigurationRow(props) {
  const { onSelect, translate } = props;

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <li
      class={ [
        'bio-properties-panel-configuration-chooser-popover-row',
        'bio-properties-panel-configuration-chooser-popover-row--empty'
      ].join(' ') }
      role="button"
      tabIndex={ 0 }
      aria-pressed={ false }
      onClick={ onSelect }
      onKeyDown={ onKeyDown }>
      <span
        class="bio-properties-panel-configuration-chooser-logo bio-properties-panel-configuration-chooser-logo--empty"
        aria-hidden="true" />
      <span class="bio-properties-panel-configuration-chooser-subtitle">
        { translate('No selection') }
      </span>
    </li>
  );
}

function ConfigurationRow(props) {
  const {
    instance,
    onSelect,
    selected
  } = props;

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  const classes = [ 'bio-properties-panel-configuration-chooser-popover-row' ];

  if (selected) {
    classes.push('bio-properties-panel-configuration-chooser-popover-row--selected');
  }

  return (
    <li
      class={ classes.join(' ') }
      role="button"
      tabIndex={ 0 }
      aria-pressed={ selected }
      onClick={ onSelect }
      onKeyDown={ onKeyDown }>
      <ConfigurationLogo instance={ instance } />
      <span class="bio-properties-panel-configuration-chooser-text">
        <span class="bio-properties-panel-configuration-chooser-title">
          { getDisplayName(instance) }
        </span>
        <span class="bio-properties-panel-configuration-chooser-subtitle">
          <span class="bio-properties-panel-configuration-chooser-varname">{ instance.name }</span>
        </span>
      </span>
    </li>
  );
}

function ConfigurationLogo(props) {
  const { instance, warning } = props;

  if (warning) {
    return (
      <span class="bio-properties-panel-configuration-chooser-logo bio-properties-panel-configuration-chooser-logo--placeholder bio-properties-panel-configuration-chooser-logo--warning">
        !
      </span>
    );
  }

  if (instance.icon) {
    return (
      <img
        class="bio-properties-panel-configuration-chooser-logo"
        src={ instance.icon }
        alt="" />
    );
  }

  const initial = getDisplayName(instance).charAt(0).toUpperCase();

  return (
    <span class="bio-properties-panel-configuration-chooser-logo bio-properties-panel-configuration-chooser-logo--placeholder">
      { initial }
    </span>
  );
}

/**
 * Whether the configuration chooser has a non-empty selection.
 *
 * @param {HTMLElement} node
 * @returns {boolean}
 */
export function isConfigurationChooserEdited(node) {
  return !!domQuery(
    '.bio-properties-panel-configuration-chooser-selected, .bio-properties-panel-configuration-chooser-missing, .bio-properties-panel-configuration-chooser-loading',
    node
  );
}

function isSameChooser(event, element, property) {
  if (event.element === element && event.property === property) {
    return true;
  }

  return event.element?.id === element.id
    && event.property?.id === property.id;
}
