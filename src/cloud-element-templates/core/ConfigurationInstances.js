/**
 * @typedef { {
 *   name: string,
 *   displayName: string,
 *   configurationTemplate: string,
 *   configurationTemplateVersion?: number,
 *   type?: string,
 *   authType?: string,
 *   status?: 'active' | 'inactive',
 *   icon?: string
 * } } ConfigurationInstance
 */

/**
 * Registry of available configuration instances (cluster variables with
 * `kind = CREDENTIAL`).
 *
 * For the prototype this is mock-backed: instances are injected via
 * `setInstances()`. A future `ConfigurationInstancesLoader` would populate
 * this from the cluster API.
 */
export default class ConfigurationInstances {
  constructor(eventBus) {
    this._eventBus = eventBus;

    /** @type {ConfigurationInstance[]} */
    this._instances = [];

    /** @type {boolean} */
    this._loaded = false;
  }

  /**
   * Replace the set of available instances and notify listeners.
   *
   * @param {ConfigurationInstance[]} instances
   */
  setInstances(instances) {
    this._instances = instances || [];
    this._loaded = true;

    this._eventBus.fire('configurationInstances.changed', {
      instances: this._instances
    });
  }

  /**
   * Whether instances have been loaded at least once.
   *
   * @returns {boolean}
   */
  isLoaded() {
    return this._loaded;
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
   * Get instances matching the given template reference, split by version
   * compatibility.
   *
   * @param {string} templateRef - configuration template ID
   * @param {number} [minVersion] - minimum version floor (inclusive)
   * @returns {{ compatible: ConfigurationInstance[], incompatible: ConfigurationInstance[] }}
   */
  getByTemplateRef(templateRef, minVersion) {
    const compatible = [];
    const incompatible = [];

    for (const instance of this._instances) {
      const instanceTemplate = instance.configurationTemplate != null ? instance.configurationTemplate : instance.templateRef;
      const instanceVersion = instance.configurationTemplateVersion != null ? instance.configurationTemplateVersion : instance.version;

      if (instanceTemplate !== templateRef) {
        continue;
      }

      if (minVersion != null && instanceVersion != null && instanceVersion < minVersion) {
        incompatible.push(instance);
      } else {
        compatible.push(instance);
      }
    }

    return { compatible, incompatible };
  }
}

ConfigurationInstances.$inject = [ 'eventBus' ];
