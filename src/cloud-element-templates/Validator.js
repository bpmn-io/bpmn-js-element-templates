import {
  Validator as BaseValidator,
  filteredSchemaErrors,
  getSchemaVersion
} from '../element-templates/Validator';

import semverCompare from 'semver-compare';

import {
  validRange as isSemverRangeValid
} from 'semver';

import {
  validateZeebe as validateAgainstSchema,
  getZeebeSchemaPackage as getTemplateSchemaPackage,
  getZeebeSchemaVersion as getTemplateSchemaVersion
} from '@bpmn-io/element-templates-validator';
import { forEach } from 'min-dash';

const SUPPORTED_SCHEMA_VERSION = getTemplateSchemaVersion();
const SUPPORTED_SCHEMA_PACKAGE = getTemplateSchemaPackage();

/**
 * A Camunda Cloud element template validator.
 */
export class Validator extends BaseValidator {
  constructor(moddle) {
    super(moddle);
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
          version = template.version || '_',
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

    // (5) JSON schema compliance
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

    // (6) engines validation
    const enginesError = this._validateEngines(template);

    if (enginesError) {
      return enginesError;
    }

    return null;
  }

  isSchemaValid(schema) {
    return schema && schema.includes(SUPPORTED_SCHEMA_PACKAGE);
  }

  _validateEngines(template) {

    let err;

    forEach(template.engines, (rangeStr, engine) => {

      if (!isSemverRangeValid(rangeStr)) {
        err = this._logError(new Error(
          `Engine <${engine}> specifies invalid semver range <${rangeStr}>`
        ), template);
      }
    });

    return err;
  }
}
