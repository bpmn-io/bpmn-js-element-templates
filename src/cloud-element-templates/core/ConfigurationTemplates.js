/**
 * @typedef { {
 *   id: string,
 *   name: string,
 *   version: number,
 *   icon?: { contents: string },
 *   properties?: Array<Object>
 * } } ConfigurationTemplate
 */

/**
 * Registry for configuration templates extracted from element templates.
 *
 * Listens to `elementTemplates.changed` and automatically indexes all
 * `configurationTemplates` entries found in the loaded element templates.
 */
export default class ConfigurationTemplates {
  constructor(elementTemplates, eventBus) {
    this._eventBus = eventBus;
    this._elementTemplates = elementTemplates;

    /** @type {Object<string, Object<number, ConfigurationTemplate>>} */
    this._byId = {};

    eventBus.on('elementTemplates.changed', () => {
      this._extract();
      this._eventBus.fire('configurationTemplates.changed');
    });
  }

  /**
   * Get a configuration template by ID and optional version.
   * Without version, returns the latest.
   *
   * @param {string} id
   * @param {number} [version]
   * @returns {ConfigurationTemplate|null}
   */
  get(id, version) {
    const versions = this._byId[id];

    if (!versions) {
      return null;
    }

    if (version != null) {
      return versions[version] || null;
    }

    // return latest
    const latest = Object.keys(versions)
      .map(Number)
      .sort((a, b) => b - a)[0];

    return versions[latest] || null;
  }

  /**
   * Get all configuration templates (all versions).
   *
   * @returns {ConfigurationTemplate[]}
   */
  getAll() {
    const result = [];

    for (const versions of Object.values(this._byId)) {
      for (const template of Object.values(versions)) {
        result.push(template);
      }
    }

    return result;
  }

  /**
   * Get the latest version of each configuration template.
   *
   * @returns {ConfigurationTemplate[]}
   */
  getLatest() {
    const result = [];

    for (const versions of Object.values(this._byId)) {
      const latest = Object.keys(versions)
        .map(Number)
        .sort((a, b) => b - a)[0];

      result.push(versions[latest]);
    }

    return result;
  }

  /**
   * Extract configuration templates from all loaded element templates.
   */
  _extract() {
    const map = {};

    for (const elementTemplate of this._elementTemplates.getAll()) {
      const configurationTemplates = elementTemplate.configurationTemplates;

      if (!configurationTemplates) {
        continue;
      }

      for (const ct of configurationTemplates) {
        const { id, version = 1 } = ct;

        if (!map[id]) {
          map[id] = {};
        }

        // highest version wins on collision within same id+version
        if (!map[id][version]) {
          map[id][version] = ct;
        }
      }
    }

    this._byId = map;
  }
}

ConfigurationTemplates.$inject = [ 'elementTemplates', 'eventBus' ];
