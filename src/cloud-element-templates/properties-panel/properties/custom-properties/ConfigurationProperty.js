import { useService } from 'bpmn-js-properties-panel';

import { useCallback, useEffect, useMemo, useRef, useState } from '@bpmn-io/properties-panel/preact/hooks';
import { CreateIcon, useError, useShowEntryEvent } from '@bpmn-io/properties-panel';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { query as domQuery } from 'min-dom';

import classnames from 'classnames';

import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { propertyGetter, propertySetter, propertyValidator } from './util';
import { useActiveIndex, useFocusOut, usePopup } from './hooks';

import { findExtension, findInputParameter, findZeebeProperty } from '../../../Helper';

// which end of the actions menu to focus when it opens; ArrowUp on the trigger
// opens onto the last item, matching the WAI-ARIA menu button pattern
const FOCUS_FIRST = 'first';
const FOCUS_LAST = 'last';

// the mutually exclusive states the chooser can render
const VARIANT = {
  ERROR: 'error',
  SELECTED: 'selected',
  LOADING: 'loading',
  MISSING: 'missing',
  OFFLINE: 'offline',
  PLACEHOLDER: 'placeholder'
};

/**
 * Pick which chooser variant to render from the current instance state. Kept
 * pure (and order-sensitive) so the state machine is explicit and testable.
 *
 * @param {Object} state
 * @returns {string} one of VARIANT
 */
function getConfigurationVariant(state) {
  const { value, error, selected, loading, available } = state;

  if (value && error) {
    return VARIANT.ERROR;
  }

  if (selected) {
    return VARIANT.SELECTED;
  }

  if (!value) {
    return VARIANT.PLACEHOLDER;
  }

  if (loading) {
    return VARIANT.LOADING;
  }

  if (available) {
    return VARIANT.MISSING;
  }

  return VARIANT.OFFLINE;
}

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

    baseSetValue(value, null, {
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

  // apply the template's `constraints`, as every other custom property does
  const validate = useMemo(
    () => propertyValidator(translate, property),
    [ translate, property ]
  );

  const globalValidationError = useError(id);
  const [ localValidationError, setLocalValidationError ] = useState(null);

  useEffect(() => {
    setLocalValidationError(validate(value) || null);
  }, [ validate, value ]);

  const validationError = globalValidationError || localValidationError;

  const ref = useRef(null);
  const showEntryRef = useShowEntryEvent(id);
  const listboxId = `${ id }-listbox`;
  const menuId = `${ id }-menu`;
  const availabilityRef = useRef({ error, available });

  // Resolve the current trigger. It changes with the selection (placeholder
  // button vs. selected/missing card), so we resolve it from the DOM rather
  // than holding a ref to a specific node.
  const resolveTrigger = useCallback(() => {
    const node = ref.current;

    return node && domQuery(
      '.bio-properties-panel-configuration-chooser-placeholder,'
      + '.bio-properties-panel-configuration-chooser-trigger',
      node
    );
  }, []);

  // Resolve the actions ("…") menu button. Like the trigger, it lives inside
  // whichever card variant is rendered, so we resolve it from the DOM.
  const resolveMenuButton = useCallback(() => {
    const node = ref.current;

    return node && domQuery('.bio-properties-panel-configuration-chooser-menu', node);
  }, []);

  const popover = usePopup({ resolveReturnFocus: resolveTrigger });
  const menu = usePopup({ resolveReturnFocus: resolveMenuButton });

  const {
    open: popoverOpen,
    show: showPopover,
    close: closePopover,
    dismiss: dismissPopover
  } = popover;

  const {
    open: menuOpen,
    payload: menuInitialFocus,
    toggle: toggleMenuState,
    close: closeMenu,
    dismiss: dismissMenu
  } = menu;

  useEffect(() => {
    const previousAvailability = availabilityRef.current;

    availabilityRef.current = { error, available };

    if (
      (!previousAvailability.error && error)
      || (previousAvailability.available && !available)
    ) {
      dismissPopover();
      dismissMenu();
    }
  }, [ error, available, dismissPopover, dismissMenu ]);

  // close popover/menu on outside click
  useEffect(() => {
    if (!popoverOpen && !menuOpen) {
      return;
    }

    const onDocPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        dismissPopover();
        dismissMenu();
      }
    };

    document.addEventListener('mousedown', onDocPointer, true);

    return () => {
      document.removeEventListener('mousedown', onDocPointer, true);
    };
  }, [ popoverOpen, menuOpen, dismissPopover, dismissMenu ]);

  const select = useCallback((name) => {
    if (disabled) {
      return;
    }

    const instance = instances.find(instance => instance.name === name);

    setValue(name ? toReference(name) : '', instance);

    // return focus to the trigger once the (possibly freshly rendered) card mounts
    closePopover();
    dismissMenu();
  }, [ disabled, instances, setValue, closePopover, dismissMenu ]);

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
      dismissPopover();
      dismissMenu();
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
    setValue,
    dismissPopover,
    dismissMenu
  ]);

  const createConfiguration = useCallback(() => {
    dismissPopover();

    eventBus.fire('configuration.create', {
      element,
      property,
      configurationTemplate,
      configurationTemplateVersion
    });
  }, [ eventBus, element, property, configurationTemplate, configurationTemplateVersion, dismissPopover ]);

  const editConfiguration = useCallback(() => {
    dismissMenu();

    eventBus.fire('configuration.edit', {
      element,
      property,
      instance: selected,
      configurationTemplate,
      configurationTemplateVersion
    });
  }, [ eventBus, element, property, selected, configurationTemplate, configurationTemplateVersion, dismissMenu ]);

  const upgradeConfiguration = useCallback(() => {
    dismissMenu();

    eventBus.fire('configuration.upgrade', {
      element,
      property,
      instance: boundInstance,
      configurationTemplate,
      configurationTemplateVersion
    });
  }, [ eventBus, element, property, boundInstance, configurationTemplate, configurationTemplateVersion, dismissMenu ]);

  const toggleOpen = useCallback(() => {
    if (disabled || error || !available) {
      return;
    }

    dismissMenu();

    // clicking the trigger while the dropdown is open closes it (canonical
    // dropdown behavior), returning focus to the trigger
    if (popoverOpen) {
      closePopover();
    } else {
      showPopover();
    }
  }, [ disabled, error, available, popoverOpen, dismissMenu, closePopover, showPopover ]);

  const toggleMenu = useCallback((event, initialFocus = FOCUS_FIRST) => {
    if (disabled) {
      return;
    }

    event.stopPropagation();
    dismissPopover();
    toggleMenuState(initialFocus);
  }, [ disabled, dismissPopover, toggleMenuState ]);

  const variant = getConfigurationVariant({ value, error, selected, loading, available });

  const renderConfiguration = () => {
    switch (variant) {
    case VARIANT.ERROR:
      return (
        <ErrorConfiguration
          value={ value }
          cachedName={ cachedName }
          disabled={ disabled }
          menuId={ menuId }
          menuOpen={ menuOpen }
          onMenu={ toggleMenu }
          translate={ translate } />
      );
    case VARIANT.SELECTED:
      return (
        <SelectedConfiguration
          instance={ selected }
          disabled={ disabled }
          menuId={ menuId }
          menuOpen={ menuOpen }
          open={ popoverOpen }
          listboxId={ listboxId }
          onClick={ toggleOpen }
          onMenu={ toggleMenu }
          translate={ translate } />
      );
    case VARIANT.LOADING:
      return (
        <LoadingConfiguration cachedName={ cachedName } translate={ translate } />
      );
    case VARIANT.MISSING:
      return (
        <MissingConfiguration
          value={ value }
          cachedName={ cachedName }
          instance={ incompatible ? boundInstance : null }
          minimumVersion={ minimumConfigurationTemplateVersion }
          typeIncompatible={ typeIncompatible }
          disabled={ disabled }
          menuId={ menuId }
          menuOpen={ menuOpen }
          open={ popoverOpen }
          listboxId={ listboxId }
          onClick={ toggleOpen }
          onMenu={ toggleMenu }
          translate={ translate } />
      );
    case VARIANT.OFFLINE:
      return (
        <OfflineConfiguration
          value={ value }
          cachedName={ cachedName }
          unavailableMessage={ unavailableMessage }
          disabled={ disabled }
          menuId={ menuId }
          menuOpen={ menuOpen }
          icon={ configurationTemplates.get(configurationTemplate, configurationTemplateVersion)?.icon?.contents }
          onMenu={ toggleMenu }
          translate={ translate } />
      );
    default:
      return (
        <PlaceholderConfiguration
          id={ id }
          disabled={ disabled }
          error={ error }
          available={ available }
          unavailableMessage={ unavailableMessage }
          open={ popoverOpen }
          listboxId={ listboxId }
          chooserLabel={ chooserLabel }
          onClick={ toggleOpen }
          showEntryRef={ showEntryRef }
          translate={ translate } />
      );
    }
  };

  return (
    <div
      ref={ ref }
      class={ classnames(
        'bio-properties-panel-entry',
        'bio-properties-panel-configuration-chooser',
        validationError ? 'has-error' : ''
      ) }
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

      { renderConfiguration() }

      {
        validationError
          ? (
            <div class="bio-properties-panel-error">
              { validationError }
            </div>
          )
          : null
      }

      {
        popoverOpen
          ? (
            <ConfigurationPopover
              listboxId={ listboxId }
              instances={ instances }
              selected={ selected }
              canCreate={ canCreate }
              onCreate={ createConfiguration }
              onSelect={ select }
              onClose={ closePopover }
              onDismiss={ dismissPopover }
              loading={ loading }
              translate={ translate } />
          )
          : null
      }

      {
        menuOpen
          ? (
            <ConfigurationContextMenu
              menuId={ menuId }
              initialFocus={ menuInitialFocus }
              onEdit={ selected && canUpdate ? editConfiguration : null }
              onUpgrade={ versionIncompatible && canUpdate ? upgradeConfiguration : null }
              onRemove={ () => select(null) }
              onClose={ closeMenu }
              onDismiss={ dismissMenu }
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
    listboxId,
    menuId,
    menuOpen,
    open,
    onClick,
    onMenu,
    translate
  } = props;

  return (
    <div class="bio-properties-panel-configuration-chooser-selected">
      <ConfigurationTrigger
        disabled={ disabled }
        listboxId={ listboxId }
        open={ open }
        onClick={ onClick }>
        <ConfigurationLogo instance={ instance } />
        <span class="bio-properties-panel-configuration-chooser-text">
          <span class="bio-properties-panel-configuration-chooser-title">
            { getDisplayName(instance) }
          </span>
          <span class="bio-properties-panel-configuration-chooser-subtitle">
            <span class="bio-properties-panel-configuration-chooser-varname">{ instance.name }</span>
          </span>
        </span>
      </ConfigurationTrigger>
      <ConfigurationMenuButton
        menuId={ menuId }
        menuOpen={ menuOpen }
        disabled={ disabled }
        onMenu={ onMenu }
        translate={ translate } />
    </div>
  );
}

function ConfigurationTrigger(props) {
  const {
    children,
    disabled,
    listboxId,
    open,
    onClick
  } = props;

  return (
    <button
      type="button"
      class="bio-properties-panel-configuration-chooser-trigger"
      disabled={ disabled }
      aria-haspopup="listbox"
      aria-expanded={ open }
      aria-controls={ open ? listboxId : undefined }
      onMouseDown={ open ? (event) => event.preventDefault() : undefined }
      onClick={ disabled ? null : onClick }>
      { children }
    </button>
  );
}

function ConfigurationMenuButton(props) {
  const { disabled, menuId, menuOpen, onMenu, translate } = props;

  const onKeyDown = (event) => {

    if (menuOpen) {
      return;
    }

    // open the menu with the arrow keys, matching native menu-button behaviour:
    // ArrowDown focuses the first item, ArrowUp the last
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMenu(event, FOCUS_FIRST);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMenu(event, FOCUS_LAST);
    }
  };

  return (
    <button
      type="button"
      class="bio-properties-panel-configuration-chooser-menu"
      title={ translate('More actions') }
      aria-label={ translate('More actions') }
      aria-haspopup="menu"
      aria-expanded={ menuOpen }
      aria-controls={ menuOpen ? menuId : undefined }
      disabled={ disabled }
      onClick={ onMenu }
      onKeyDown={ onKeyDown }>
      …
    </button>
  );
}

function ConfigurationContextMenu(props) {
  const { initialFocus, menuId, onClose, onDismiss, onEdit, onRemove, onUpgrade, translate } = props;

  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  const items = [];

  if (onEdit) {
    items.push({ key: 'edit', label: translate('Edit'), onClick: onEdit });
  }

  if (onUpgrade) {
    items.push({ key: 'upgrade', label: translate('Upgrade'), onClick: onUpgrade });
  }

  items.push({ key: 'remove', label: translate('Unset'), onClick: onRemove });

  const itemCount = items.length;

  // the menu is re-mounted on each open, so useActiveIndex re-seeds from the
  // current initialFocus intent ('first' vs 'last') each time
  const [ activeIndex, setActiveIndex, onNavigationKeyDown ] = useActiveIndex(itemCount, {
    initialIndex: initialFocus === FOCUS_LAST ? itemCount - 1 : 0,
    wrap: true
  });

  // move real focus to the active item (menus use roving focus rather than
  // aria-activedescendant); this also moves focus into the menu on open
  useEffect(() => {
    const node = itemRefs.current[ activeIndex ];

    if (node) {
      node.focus();
    }
  }, [ activeIndex ]);

  const onKeyDown = (event) => {
    onNavigationKeyDown(event);

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  // close the menu once focus leaves it entirely (e.g. tabbing away), letting
  // focus continue to its natural destination
  useFocusOut(menuRef, onDismiss);

  return (
    <div
      ref={ menuRef }
      id={ menuId }
      role="menu"
      aria-label={ translate('More actions') }
      class="bio-properties-panel-configuration-chooser-context-menu"
      onKeyDown={ onKeyDown }>
      {
        items.map((item, index) => (
          <button
            key={ item.key }
            ref={ node => itemRefs.current[ index ] = node }
            type="button"
            role="menuitem"
            tabIndex={ index === activeIndex ? 0 : -1 }
            class="bio-properties-panel-configuration-chooser-context-menu-item"
            onClick={ item.onClick }
            onMouseEnter={ () => setActiveIndex(index) }>
            { item.label }
          </button>
        ))
      }
    </div>
  );
}

function PlaceholderConfiguration(props) {
  const {
    available,
    chooserLabel,
    disabled,
    error,
    id,
    listboxId,
    onClick,
    open,
    showEntryRef,
    translate,
    unavailableMessage
  } = props;

  const describedBy = error
    ? `${ id }-error`
    : !available && unavailableMessage
      ? `${ id }-unavailable`
      : undefined;

  return (
    <>
      <button
        ref={ showEntryRef }
        type="button"
        class="bio-properties-panel-configuration-chooser-placeholder"
        disabled={ disabled || error || !available }
        aria-haspopup="listbox"
        aria-controls={ open ? listboxId : undefined }
        aria-describedby={ describedBy }
        aria-expanded={ open }
        onClick={ onClick }>
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
    menuId,
    menuOpen,
    onMenu,
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
      <ConfigurationMenuButton
        menuId={ menuId }
        menuOpen={ menuOpen }
        disabled={ disabled }
        onMenu={ onMenu }
        translate={ translate } />
    </div>
  );
}

function MissingConfiguration(props) {
  const {
    cachedName,
    disabled,
    instance,
    listboxId,
    menuId,
    menuOpen,
    minimumVersion,
    open,
    onClick,
    onMenu,
    translate,
    typeIncompatible,
    value
  } = props;

  // extract variable name from FEEL expression
  const refName = fromReference(value);
  const instanceVersion = instance?.metadata?.configurationTemplateVersion;

  const title = instance
    ? getDisplayName(instance)
    : cachedName || translate('Configuration not found');

  const subtitle = instance
    ? typeIncompatible
      ? translate('Incompatible configuration type')
      : translate('Version {version} · Requires version {minimumVersion}+', {
        version: instanceVersion == null ? '?' : instanceVersion,
        minimumVersion
      })
    : cachedName ? translate('Not found on cluster') : refName;

  return (
    <div class="bio-properties-panel-configuration-chooser-missing">
      <ConfigurationTrigger
        disabled={ disabled }
        listboxId={ listboxId }
        open={ open }
        onClick={ onClick }>
        <ConfigurationLogo warning />
        <span class="bio-properties-panel-configuration-chooser-text">
          <span class="bio-properties-panel-configuration-chooser-title">
            { title }
          </span>
          <span class="bio-properties-panel-configuration-chooser-subtitle">
            { subtitle }
          </span>
        </span>
      </ConfigurationTrigger>
      <ConfigurationMenuButton
        menuId={ menuId }
        menuOpen={ menuOpen }
        disabled={ disabled }
        onMenu={ onMenu }
        translate={ translate } />
    </div>
  );
}

function OfflineConfiguration(props) {
  const {
    cachedName,
    disabled,
    icon,
    menuId,
    menuOpen,
    onMenu,
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
      <ConfigurationMenuButton
        menuId={ menuId }
        menuOpen={ menuOpen }
        disabled={ disabled }
        onMenu={ onMenu }
        translate={ translate } />
    </div>
  );
}

function ConfigurationPopover(props) {
  const {
    canCreate,
    instances,
    listboxId,
    loading,
    onClose,
    onCreate,
    onDismiss,
    onSelect,
    selected,
    translate
  } = props;

  const listRef = useRef(null);
  const createRef = useRef(null);
  const popoverRef = useRef(null);

  const createId = `${ listboxId }-create`;

  // the create action participates in keyboard navigation as a trailing option
  const createIndex = canCreate ? instances.length : -1;
  const optionCount = instances.length + (canCreate ? 1 : 0);

  const selectedIndex = instances.findIndex(instance => instance === selected);

  const [ activeIndex, setActiveIndex, onNavigationKeyDown ] = useActiveIndex(optionCount, {
    initialIndex: selectedIndex >= 0 ? selectedIndex : 0
  });

  // move focus into the popover so it can be operated by keyboard; the parent
  // restores focus to the trigger when the popover is closed via keyboard
  useEffect(() => {
    if (listRef.current) {
      listRef.current.focus();
    } else if (createRef.current) {
      createRef.current.focus();
    }
  }, []);

  const isCreateActive = canCreate && activeIndex === createIndex;
  const activeInstance = isCreateActive ? null : instances[ activeIndex ];

  const optionId = (instance) => `${ listboxId }-option-${ instance.name }`;

  const activeDescendant = isCreateActive
    ? createId
    : activeInstance
      ? optionId(activeInstance)
      : undefined;

  const activateSelection = () => {
    if (isCreateActive) {
      onCreate();
    } else if (activeInstance) {
      onSelect(selected === activeInstance ? null : activeInstance.name);
    }
  };

  const onKeyDown = (event) => {
    onNavigationKeyDown(event);

    const { key } = event;

    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      activateSelection();
    } else if (key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  // close the popover once focus leaves it entirely (e.g. tabbing to the next
  // field), letting focus continue to its natural destination
  useFocusOut(popoverRef, onDismiss);

  return (
    <div
      ref={ popoverRef }
      class="bio-properties-panel-configuration-chooser-popover"
      onKeyDown={ onKeyDown }>
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

      <ul
        ref={ listRef }
        id={ listboxId }
        role="listbox"
        tabIndex={ -1 }
        aria-label={ translate('Configurations') }
        aria-activedescendant={ activeDescendant }
        aria-owns={ canCreate ? createId : undefined }
        class="bio-properties-panel-configuration-chooser-popover-list">
        {
          instances.length
            ? instances.map((instance, index) => (
              <ConfigurationRow
                key={ instance.name }
                id={ optionId(instance) }
                instance={ instance }
                active={ index === activeIndex }
                selected={ selected === instance }
                onSelect={ () => onSelect(selected === instance ? null : instance.name) }
                onHover={ () => setActiveIndex(index) }
                translate={ translate } />
            ))
            : (
              <li
                class="bio-properties-panel-configuration-chooser-empty"
                role="presentation">
                <span role="status">
                  {
                    loading
                      ? translate('Loading...')
                      : translate('No compatible configurations are available in the connected cluster')
                  }
                </span>
              </li>
            )
        }
      </ul>

      {
        canCreate
          ? (
            <button
              ref={ createRef }
              type="button"
              id={ createId }
              role="option"
              tabIndex={ -1 }
              aria-selected={ false }
              class={
                isCreateActive
                  ? 'bio-properties-panel-configuration-chooser-create bio-properties-panel-configuration-chooser-create--active'
                  : 'bio-properties-panel-configuration-chooser-create'
              }
              onClick={ onCreate }
              onMouseEnter={ () => setActiveIndex(createIndex) }>
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

function ConfigurationRow(props) {
  const {
    active,
    id,
    instance,
    onHover,
    onSelect,
    selected
  } = props;

  const classes = [ 'bio-properties-panel-configuration-chooser-popover-row' ];

  if (selected) {
    classes.push('bio-properties-panel-configuration-chooser-popover-row--selected');
  }

  if (active) {
    classes.push('bio-properties-panel-configuration-chooser-popover-row--active');
  }

  return (
    <li
      id={ id }
      class={ classes.join(' ') }
      role="option"
      aria-selected={ selected }
      onClick={ onSelect }
      onMouseEnter={ onHover }>
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
