# bpmn-js-element-templates

An [element templates](https://github.com/bpmn-io/element-templates) provider for [bpmn-js](https://github.com/bpmn-io/bpmn-js).

## Usage

Use this module in addition to [bpmn-js](https://github.com/bpmn-io/bpmn-js) and the [bpmn-js-properties-panel](https://github.com/bpmn-io/bpmn-js-properties-panel#usage):

```javascript
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';

import {
    ElementTemplatesPropertiesProviderModule, // Camunda 7 Element Templates
    // CloudElementTemplatesPropertiesProviderModule // Camunda 8 Element Templates
} from 'bpmn-js-element-templates';

const modeler = new BpmnModeler({
  container: '#canvas',
  propertiesPanel: {
    parent: '#properties'
  },
  additionalModules: [
    BpmnPropertiesPanelModule,
    BpmnPropertiesProviderModule,
    ElementTemplatesPropertiesProviderModule,
    // CloudElementTemplatesPropertiesProviderModule
  ]
});
```

To set an element template from the properties panel, plug-in an [element template chooser](https://github.com/bpmn-io/element-template-chooser).

## Migration engine v0

The `bpmn-js-element-templates/migration` entry point provides the migration
engine from [c8ctl at `673214a`](https://github.com/camunda/c8ctl/tree/673214a1547c79167a18b25023924baf19a1be3c/default-plugins/element-template/migration),
including its recipe, compatibility-floor, and report semantics. It works in
browsers and Node, without a CLI or network access.
The ESM export uses an explicit `.mjs` build, so Node does not need module
syntax detection and the package-wide module convention stays unchanged.

```javascript
import { migrateElement, parseRecipe, readAppliedTemplate } from 'bpmn-js-element-templates/migration';

const { element: migratedElement, report } = migrateElement({
  modeler,
  element,
  fromTemplate,
  target,
  templates
});
```

`modeler` is a bpmn-js modeler (or a Node headless modeler) configured with
`CloudElementTemplatesCoreModule` from `bpmn-js-element-templates/core` and the
Zeebe moddle extension. Start migrations outside an active command. Each
migration executes in one command group; one `commandStack.undo()` restores
the original element. Failed applications roll back completed commands and
restore the template catalog and undo/redo history before rethrowing the error.
As with other modeling operations, custom command handlers must be undoable.

`templates` supplies the source, target, and required intermediate versions as
JSON template definitions. Additional options follow the pinned engine:

* `recipe`: a parsed recipe overriding `target.metadata.migratesFrom`;
* `sourceKnown: false`: the supplied source is an unavailable-template stub;
* `engineVersion` and `isCompatible(template)`: explain and resolve source floors;
* `maps`: original-value moves, shaped as `{ from: { bindingType, key }, to: { bindingType, key } }`.

The result is `{ element, report }`. Always use the returned element, since a
template may replace the shape. The report retains the pinned engine's facts
and losslessness decisions; this API does not introduce authorization policy.
`parseRecipe(raw)` validates a recipe and throws `RecipeError` on invalid
input. `readAppliedTemplate(businessObject)` returns `{ id, version }` or
`undefined`. The v1 recipe schema is exported as
`bpmn-js-element-templates/migration/migrates-from.schema.json`.
The current recipe format is provisional, not a supported external contract.
Formal schema support belongs to a separate issue in the migration epic.
Unsupported schema versions raise `RecipeError`; host applications own any
upgrade guidance or recovery policy.
The entry point also re-exports `resolveCatalog`, `latestOf`, `findSuccessors`,
`readEmbeddedRecipe`, `validateRecipeOwner`, `DestinationError`, `emptyFacts`,
and `buildReport` unchanged from their existing engine modules.

Failure recovery currently snapshots diagram-js `CommandStack` private state
(`_currentExecution`, `_stack`, and `_stackIdx`), which is not a public API.
Tests cover the configured diagram-js version; compatibility across every
version accepted by the peer dependency is not guaranteed.

The engine is self-contained in `src/migration/`. Its JavaScript port removes
TypeScript annotations; a local strict JSON comparator replaces the Node-only
utility. The modeler transaction adapter is separate from recipe and report
logic. The upstream MIT notice is retained in `src/migration/LICENSE` and
distributed as `dist/migration.LICENSE`.

### Migration tests

`npm run all` includes the shared offline regression cases in both Chrome and
a Node headless modeler (`npm run test:node`). The Agent and REST JSON templates
and both migration BPMN fixtures are copied from the same c8ctl commit.
`test/fixtures/migration/expected.json` freezes full reports, applied template
identities, and binding values produced by that pinned engine, independently
of this port. Both runtimes check those same expectations, grouped undo/redo,
and injected application failures. Network-dependent upstream fidelity checks
and cluster/CLI integration tests are not part of this library's default suite.

## Additional resources

* [About element templates](https://github.com/bpmn-io/element-templates)
* [Issue tracker](https://github.com/bpmn-io/bpmn-js-element-templates/issues)
* [Forum](https://forum.bpmn.io)

## Development

Prepare the project by installing all dependencies:

```sh
npm install
```

Then, depending on your use-case, you may run any of the following commands:

```sh
# build the library and run all tests
npm run all

# spin up a single local modeler instance
npm start

# run the full development setup
npm run dev
```

## License

MIT
