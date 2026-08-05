/**
 * @typedef { {
 *   name: string,
 *   metadata: {
 *     kind: string,
 *     displayName?: string,
 *     configurationTemplate: string,
 *     configurationTemplateVersion?: number
 *   },
 *   icon?: string
 * } } ConfigurationInstance
 */

/**
 * @typedef { {
 *   create?: boolean,
 *   update?: boolean
 * } } ConfigurationPermissions
 */

/**
 * Registry of available template-derived configuration instances (cluster
 * variables with a metadata `kind`).
 */
export default class ConfigurationInstances {
  constructor(eventBus) {
    this._eventBus = eventBus;

    /** @type {ConfigurationInstance[]} */
    this._selectableInstances = [];

    /** @type {Record<string, ConfigurationInstance>} */
    this._referencedInstancesByName = {};

    /** @type {boolean} */
    this._loading = false;

    /** @type {boolean} */
    this._error = false;

    /** @type {boolean} */
    this._available = false;

    /** @type {string|null} */
    this._unavailableMessage = null;

    /** @type {{ create: boolean, update: boolean }} */
    this._permissions = {
      create: false,
      update: false
    };
  }

  /**
   * Replace the configurations that may appear as chooser options and notify
   * listeners.
   *
   * @param {ConfigurationInstance[]} selectableInstances
   */
  setSelectableInstances(selectableInstances) {
    this.setState({
      selectableInstances,
      error: false,
      available: true
    });
  }

  /**
   * Replace configurations referenced in BPMN and fetched by cluster-variable
   * name, then notify listeners.
   *
   * @param {ConfigurationInstance[]} referencedInstances
   */
  setReferencedInstances(referencedInstances) {
    this.setState({
      referencedInstances
    });
  }

  /**
   * Set whether the host is loading configuration instances.
   *
   * @param {boolean} loading
   */
  setLoading(loading) {
    this.setState({
      loading,
      ...(loading ? { error: false } : {})
    });
  }

  /**
   * Update host-provided configuration instance state and notify listeners.
   *
  * @param {{ selectableInstances?: ConfigurationInstance[], referencedInstances?: ConfigurationInstance[], loading?: boolean, error?: boolean, available?: boolean, unavailableMessage?: string, permissions?: ConfigurationPermissions }} state
   */
  setState(state) {
    if ('selectableInstances' in state) {
      this._selectableInstances = state.selectableInstances || [];
    }

    if ('referencedInstances' in state) {
      const referencedInstances = state.referencedInstances || [];

      this._referencedInstancesByName = referencedInstances.reduce((byName, instance) => {
        if (!instance || !instance.name) {
          return byName;
        }

        byName[ instance.name ] = instance;

        return byName;
      }, {});
    }

    if ('loading' in state) {
      this._loading = !!state.loading;
    }

    if ('error' in state) {
      this._error = !!state.error;
    }

    if ('available' in state) {
      this._available = !!state.available;
    }

    if ('unavailableMessage' in state) {
      this._unavailableMessage = state.unavailableMessage || null;
    }

    if ('permissions' in state) {
      const permissions = state.permissions || {};

      this._permissions = {
        create: !!permissions.create,
        update: !!permissions.update
      };
    }

    if (!this._available) {
      this._error = false;
      this._permissions = {
        create: false,
        update: false
      };
      this._referencedInstancesByName = {};
    } else {
      this._unavailableMessage = null;
    }

    this._eventBus.fire('configurationInstances.changed', {
      selectableInstances: this._selectableInstances,
      loading: this._loading,
      error: this._error,
      available: this._available,
      unavailableMessage: this._unavailableMessage,
      permissions: this._permissions
    });
  }

  /**
   * Whether the host is loading configuration instances.
   *
   * @returns {boolean}
   */
  isLoading() {
    return this._loading;
  }

  /**
   * Whether loading configuration instances failed.
   *
   * @returns {boolean}
   */
  hasError() {
    return this._error;
  }

  /**
  * Whether configuration instances can be queried and managed.
   *
   * @returns {boolean}
   */
  isAvailable() {
    return this._available;
  }

  /**
   * Get the host-provided reason configuration instances are unavailable.
   *
   * @returns {string|null}
   */
  getUnavailableMessage() {
    return this._unavailableMessage;
  }

  /**
   * Whether the current user may create configuration instances.
   *
   * @returns {boolean}
   */
  canCreate() {
    return this._permissions.create;
  }

  /**
   * Whether the current user may update configuration instances.
   *
   * @returns {boolean}
   */
  canUpdate() {
    return this._permissions.update;
  }

  /**
   * Get all configurations that may appear as chooser options.
   *
   * @returns {ConfigurationInstance[]}
   */
  getSelectableInstances() {
    return this._selectableInstances;
  }

  /**
   * Get a BPMN-referenced configuration by its cluster-variable name.
   *
   * @param {string} name
   * @returns {ConfigurationInstance|undefined}
   */
  getReferencedInstanceByName(name) {
    return this._referencedInstancesByName[ name ];
  }

  /**
   * Whether an instance is compatible with the given template reference and version.
   *
   * @param {ConfigurationInstance} instance
   * @param {string} configurationTemplate - configuration template ID
   * @param {number} [minVersion] - minimum version floor (inclusive)
   * @returns {boolean}
   */
  isCompatible(instance, configurationTemplate, minVersion) {
    const {
      kind,
      configurationTemplate: instanceTemplate,
      configurationTemplateVersion: instanceVersion
    } = instance.metadata || {};

    return !!kind
      && instanceTemplate === configurationTemplate
      && (minVersion == null || (instanceVersion != null && instanceVersion >= minVersion));
  }

  /**
    * Get selectable configurations compatible with the given template reference
    * and version.
   *
   * @param {string} configurationTemplate - configuration template ID
   * @param {number} [minVersion] - minimum version floor (inclusive)
   * @returns {ConfigurationInstance[]}
   */
  getSelectableByConfigurationTemplate(configurationTemplate, minVersion) {
    const compatible = [];

    for (const instance of this._selectableInstances) {
      if (!this.isCompatible(instance, configurationTemplate, minVersion)) {
        continue;
      }

      compatible.push(instance);
    }

    return compatible;
  }
}

ConfigurationInstances.$inject = [ 'eventBus' ];
