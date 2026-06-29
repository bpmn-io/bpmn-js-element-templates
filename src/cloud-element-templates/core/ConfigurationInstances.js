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

const DEFAULT_TTL = 30000; // 30 seconds

/**
 * Registry of available configuration instances (cluster variables with
 * `kind = CREDENTIAL`).
 *
 * Supports two modes:
 * 1. Push: call `setInstances()` directly (testing, mocks)
 * 2. Fetch: register a `fetchFn` via `setFetchFn()` — the service handles
 *    caching with stale-while-revalidate semantics
 */
export default class ConfigurationInstances {
  constructor(eventBus, config) {
    this._eventBus = eventBus;

    const instancesConfig = config && config.configurationInstances || {};

    /** @type {number} */
    this._ttl = instancesConfig.ttl != null ? instancesConfig.ttl : DEFAULT_TTL;

    /** @type {ConfigurationInstance[]} */
    this._instances = [];

    /** @type {boolean} */
    this._loaded = false;

    /** @type {boolean} */
    this._fetching = false;

    /** @type {number} */
    this._lastFetchedAt = 0;

    /** @type {Function|null} */
    this._fetchFn = null;
  }

  /**
   * Register the async function that fetches instances from the cluster API.
   *
   * @param {() => Promise<ConfigurationInstance[]>} fn
   */
  setFetchFn(fn) {
    this._fetchFn = fn;
  }

  /**
   * Replace the set of available instances directly and notify listeners.
   * Resets the cache timestamp (data is fresh).
   *
   * @param {ConfigurationInstance[]} instances
   */
  setInstances(instances) {
    this._instances = instances || [];
    this._loaded = true;
    this._lastFetchedAt = Date.now();
    this._fetching = false;

    this._eventBus.fire('configurationInstances.changed', {
      instances: this._instances
    });
  }

  /**
   * Force a refresh on next access, or immediately if a fetchFn is set.
   */
  invalidate() {
    this._lastFetchedAt = 0;

    if (this._fetchFn) {
      this._refresh();
    }
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
   * Whether a background fetch is currently in progress.
   *
   * @returns {boolean}
   */
  isFetching() {
    return this._fetching;
  }

  /**
   * Get all available instances. Triggers background refresh if stale.
   *
   * @returns {ConfigurationInstance[]}
   */
  getAll() {
    this._refreshIfStale();
    return this._instances;
  }

  /**
   * Get instances matching the given template reference, split by version
   * compatibility. Triggers background refresh if stale.
   *
   * @param {string} templateRef - configuration template ID
   * @param {number} [minVersion] - minimum version floor (inclusive)
   * @returns {{ compatible: ConfigurationInstance[], incompatible: ConfigurationInstance[] }}
   */
  getByTemplateRef(templateRef, minVersion) {
    this._refreshIfStale();

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

  _refreshIfStale() {
    if (this._isStale() && !this._fetching && this._fetchFn) {
      this._refresh();
    }
  }

  _isStale() {
    return Date.now() - this._lastFetchedAt > this._ttl;
  }

  async _refresh() {
    this._fetching = true;
    this._eventBus.fire('configurationInstances.fetching');

    try {
      const instances = await this._fetchFn();
      this._instances = instances || [];
      this._loaded = true;
      this._lastFetchedAt = Date.now();
    } finally {
      this._fetching = false;
      this._eventBus.fire('configurationInstances.changed', {
        instances: this._instances
      });
    }
  }
}

ConfigurationInstances.$inject = [ 'eventBus', 'config' ];
