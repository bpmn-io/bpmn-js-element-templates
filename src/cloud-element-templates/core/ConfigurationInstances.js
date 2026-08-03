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
 * Registry of available configuration instances (cluster variables with
 * `kind = CREDENTIAL`).
 */
export default class ConfigurationInstances {
  constructor(eventBus) {
    this._eventBus = eventBus;

    /** @type {ConfigurationInstance[]} */
    this._instances = [];

    /** @type {boolean} */
    this._loading = false;

    /** @type {boolean} */
    this._error = false;

    /** @type {boolean} */
    this._clusterSelected = false;

    /** @type {{ create: boolean, update: boolean }} */
    this._permissions = {
      create: false,
      update: false
    };
  }

  /**
   * Replace the set of available instances and notify listeners.
   *
   * @param {ConfigurationInstance[]} instances
   */
  setInstances(instances) {
    this.setState({
      instances,
      error: false,
      clusterSelected: true
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
  * @param {{ instances?: ConfigurationInstance[], loading?: boolean, error?: boolean, clusterSelected?: boolean, permissions?: ConfigurationPermissions }} state
   */
  setState(state) {
    if ('instances' in state) {
      this._instances = state.instances || [];
    }

    if ('loading' in state) {
      this._loading = !!state.loading;
    }

    if ('error' in state) {
      this._error = !!state.error;
    }

    if ('clusterSelected' in state) {
      this._clusterSelected = !!state.clusterSelected;
    }

    if ('permissions' in state) {
      const permissions = state.permissions || {};

      this._permissions = {
        create: !!permissions.create,
        update: !!permissions.update
      };
    }

    if (!this._clusterSelected) {
      this._error = false;
      this._permissions = {
        create: false,
        update: false
      };
    }

    this._eventBus.fire('configurationInstances.changed', {
      instances: this._instances,
      loading: this._loading,
      error: this._error,
      clusterSelected: this._clusterSelected,
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
   * Whether the host has selected a cluster whose configuration instances can
   * be queried.
   *
   * @returns {boolean}
   */
  isClusterSelected() {
    return this._clusterSelected;
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
   * Get all available instances.
   *
   * @returns {ConfigurationInstance[]}
   */
  getAll() {
    return this._instances;
  }

  /**
   * Get an instance by its cluster-variable name.
   *
   * @param {string} name
   * @returns {ConfigurationInstance|undefined}
   */
  getByName(name) {
    return this._instances.find(instance => instance.name === name);
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

    return kind === 'CREDENTIAL'
      && instanceTemplate === configurationTemplate
      && (minVersion == null || (instanceVersion != null && instanceVersion >= minVersion));
  }

  /**
    * Get instances compatible with the given template reference and version.
   *
   * @param {string} configurationTemplate - configuration template ID
   * @param {number} [minVersion] - minimum version floor (inclusive)
   * @returns {ConfigurationInstance[]}
   */
  getByConfigurationTemplate(configurationTemplate, minVersion) {
    const compatible = [];

    for (const instance of this._instances) {
      if (!this.isCompatible(instance, configurationTemplate, minVersion)) {
        continue;
      }

      compatible.push(instance);
    }

    return compatible;
  }
}

ConfigurationInstances.$inject = [ 'eventBus' ];
