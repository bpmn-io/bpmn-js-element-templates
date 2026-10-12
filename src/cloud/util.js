/**
 * Cloud element template utilities for bundler-based programmatic use.
 *
 * Bundle this entry point with Webpack, esbuild, or Rollup. Native Node.js
 * import/require is unsupported because bpmn-js uses extensionless ESM imports.
 *
 * Read utilities expect BPMN/moddle-backed elements.
 *
 * To use setPropertyValue, register CloudElementTemplatesCoreModule
 * from the package's /core entry point as an additional modeler module,
 * then pass the modeler's bpmnFactory and commandStack services.
 */

export {
  getPropertyValue,
  setPropertyValue,
  validateProperty
} from '../cloud-element-templates/util/propertyUtil';

export {
  applyConditions,
  isConditionMet
} from '../cloud-element-templates/Condition';

export {
  shouldCastToFeel,
  toFeelExpression,
  fromFeelExpression,
  isFeel
} from '../cloud-element-templates/util/FeelUtil';

export {
  getDefaultValue
} from '../cloud-element-templates/Helper';
