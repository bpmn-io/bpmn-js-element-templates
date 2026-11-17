import { migrateElement as applyMigration } from './apply.js';
import { executeMigration } from './transaction.js';
export { parseRecipe, RecipeError } from './recipe.js';
export { readAppliedTemplate } from './apply.js';
export { resolveCatalog, latestOf, findSuccessors } from './steps.js';
export { readEmbeddedRecipe, validateRecipeOwner } from './recipe.js';
export { DestinationError, emptyFacts } from './plan.js';
export { buildReport } from './report.js';

/**
 * Migrate an element of a bpmn-js (or headless) modeler in one undoable group.
 *
 * The remaining options and the returned { element, report } follow the pinned
 * c8ctl engine. The modeler must provide CloudElementTemplatesCoreModule.
 */
export function migrateElement(options) {
  const {
    modeler
  } = options;
  const elementTemplates = modeler.get('elementTemplates');
  const modeling = modeler.get('modeling');
  const commandStack = modeler.get('commandStack');
  const catalog = elementTemplates._templates;
  const templateInputs = structuredClone({
    fromTemplate: options.fromTemplate,
    target: options.target,
    templates: options.templates
  });

  return executeMigration(commandStack, () => {
    try {
      return applyMigration({
        ...options,
        ...templateInputs,
        modeler: {
          elementTemplates,
          modeling
        }
      });
    } finally {
      elementTemplates.set(catalog);
    }
  });
}
