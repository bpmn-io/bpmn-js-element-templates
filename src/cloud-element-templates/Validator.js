import {
  Validator as BaseValidator,
  filteredSchemaErrors,
  getSchemaVersion
} from '../element-templates/Validator';

import semverCompare from 'semver-compare';

import {
  validateZeebe as validateAgainstSchema,
  getZeebeSchemaPackage as getTemplateSchemaPackage,
  getZeebeSchemaVersion as getTemplateSchemaVersion
} from '@bpmn-io/element-templates-validator';
import { isNil } from 'min-dash';

const SUPPORTED_SCHEMA_VERSION = getTemplateSchemaVersion();
const SUPPORTED_SCHEMA_PACKAGE = getTemplateSchemaPackage();

/**
 * A Camunda Cloud element template validator.
 */
export class Validator extends BaseValidator {
  constructor(moddle) {
    super(moddle);

    this._warnings = [];
  }

  /**
  * Collect warnings for conflicting configuration template definitions before
  * validating individual element templates.
   *
   * @param {TemplateDescriptor[]} templates
   * @returns {Validator}
   */
  addAll(templates) {
    const result = super.addAll(templates);

    this._warnings = getConfigurationTemplateConflictWarnings(this.getValidTemplates());

    return result;
  }

  /**
   * Validate given template and return error (if any).
   *
   * @param {TemplateDescriptor} template
   *
   * @return {Error} validation error, if any
   */
  _validateTemplate(template) {
    const id = template.id,
          version = isNil(template.version) ? '_' : template.version,
          schema = template.$schema,
          schemaVersion = schema && getSchemaVersion(schema);

    // (1) $schema attribute defined
    if (!schema) {
      return this._logError(
        'missing $schema attribute.',
        template
      );
    }

    if (!this.isSchemaValid(schema)) {
      return this._logError(
        `unsupported $schema attribute <${ schema }>.`,
        template
      );
    }

    // (2) compatibility
    if (schemaVersion && (semverCompare(SUPPORTED_SCHEMA_VERSION, schemaVersion) < 0)) {
      return this._logError(
        `unsupported element template schema version <${ schemaVersion }>. Your installation only supports up to version <${ SUPPORTED_SCHEMA_VERSION }>. Please update your installation`,
        template
      );
    }

    // (3) versioning
    if (this._templatesById[ id ] && this._templatesById[ id ][ version ]) {
      if (version === '_') {
        return this._logError(`template id <${ id }> already used`, template);
      } else {
        return this._logError(`template id <${ id }> and version <${ version }> already used`, template);
      }
    }

    // (4) elementType validation
    const elementTypeError = this._validateElementType(template);

    if (elementTypeError) {
      return elementTypeError;
    }

    // (5) configuration validation
    const configurationError = this._validateConfiguration(template);

    if (configurationError) {
      return configurationError;
    }

    // (6) JSON schema compliance
    const schemaValidationResult = validateAgainstSchema(template);

    const {
      errors: schemaErrors,
      valid
    } = schemaValidationResult;

    if (!valid) {
      filteredSchemaErrors(schemaErrors).forEach((error) => {
        this._logError(error.message, template);
      });

      return new Error('invalid template');
    }

    // (7) engines validation
    const enginesError = this._validateEngines(template);

    if (enginesError) {
      return enginesError;
    }

    return null;
  }

  _validateConfiguration(template) {
    const {
      configurationTemplates,
      properties = []
    } = template;

    if (configurationTemplates !== undefined) {
      if (!Array.isArray(configurationTemplates)) {
        return this._logError('configurationTemplates must be an array', template);
      }

      for (const configurationTemplate of configurationTemplates) {
        if (!configurationTemplate || typeof configurationTemplate !== 'object') {
          return this._logError('configurationTemplates entries must be objects', template);
        }

        if (!isNonEmptyString(configurationTemplate.id)) {
          return this._logError('configuration template id must be a non-empty string', template);
        }

        if (!isNonEmptyString(configurationTemplate.name)) {
          return this._logError('configuration template name must be a non-empty string', template);
        }

        if (!isNonEmptyString(configurationTemplate.kind)) {
          return this._logError('configuration template kind must be a non-empty string', template);
        }

        if (!Array.isArray(configurationTemplate.properties)) {
          return this._logError('configuration template properties must be an array', template);
        }
      }
    }

    for (const property of properties) {
      if (property?.type !== 'Configuration') {
        continue;
      }

      if (!isNonEmptyString(property.configurationTemplate)) {
        return this._logError('configuration property requires a configurationTemplate', template);
      }

      const { binding } = property;

      if (!binding || ![ 'zeebe:input', 'zeebe:property' ].includes(binding.type)) {
        return this._logError('configuration property binding must be zeebe:input or zeebe:property', template);
      }

      if (!isNonEmptyString(binding.name)) {
        return this._logError('configuration property binding requires a name', template);
      }
    }
  }

  isSchemaValid(schema) {
    return schema && schema.includes(SUPPORTED_SCHEMA_PACKAGE);
  }

  /**
   * Get non-blocking validation warnings.
   *
   * @returns {Error[]}
   */
  getWarnings() {
    return this._warnings;
  }
}

function getConfigurationTemplateConflictWarnings(templates) {
  const definitionsByKey = new Map();
  const warnings = [];

  if (!Array.isArray(templates)) {
    return warnings;
  }

  for (const template of templates) {
    if (!Array.isArray(template?.configurationTemplates)) {
      continue;
    }

    for (const configurationTemplate of template.configurationTemplates) {
      const key = getConfigurationTemplateKey(configurationTemplate);

      if (!key) {
        continue;
      }

      const definition = JSON.stringify(canonicalize(configurationTemplate));
      const existingDefinition = definitionsByKey.get(key);

      if (existingDefinition && existingDefinition !== definition) {
        const { id, version = 1 } = configurationTemplate;

        warnings.push(createWarning(
          `configuration template id <${ id }> and version <${ version }> conflicts with the first embedded definition and will be ignored`,
          template
        ));
      } else {
        definitionsByKey.set(key, definition);
      }
    }
  }

  return warnings;
}

function getConfigurationTemplateKey(configurationTemplate) {
  if (!configurationTemplate || !configurationTemplate.id) {
    return null;
  }

  return `${ configurationTemplate.id }@${ configurationTemplate.version ?? 1 }`;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [ key, canonicalize(value[key]) ])
    );
  }

  return value;
}

function createWarning(message, template) {
  return new Error(
    `template(id: <${ template.id }>, name: <${ template.name }>): ${ message }`
  );
}
