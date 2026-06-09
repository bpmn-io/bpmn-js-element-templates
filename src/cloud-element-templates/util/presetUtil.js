import { find } from 'min-dash';

/**
 * Get a preset by ID from a template.
 *
 * @param {Object} template
 * @param {string} presetId
 *
 * @returns {Object|undefined}
 */
function getPreset(template, presetId) {
  if (!template || !presetId) {
    return;
  }

  return find(template.presets || [], preset => preset.id === presetId);
}

/**
 * Apply a preset to a template, returning a derived template where the `value`
 * of each property referenced by the preset is overridden with the preset
 * value.
 *
 * Properties that are overridden by the preset are marked with `_presetValue: true`
 *
 * If no preset is given or it cannot be found, the template is returned
 * unchanged (the bare template is applied).
 *
 * @param {ElementTemplate} template
 * @param {string} [presetId]
 *
 * @returns {ElementTemplate} a template with preset applied
 */
export function applyPreset(template, presetId) {
  const preset = getPreset(template, presetId);

  if (!preset) {
    return template;
  }

  const overrides = preset.properties || {};

  const properties = template.properties.map(property => {
    if (Object.prototype.hasOwnProperty.call(overrides, property.id)) {
      return {
        ...property,
        value: overrides[property.id],
        _presetValue: true
      };
    }

    return property;
  });

  return {
    ...template,
    properties
  };
}
