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

To set an element template from the properties panel, plug-in an [element template chooser](https://github.com/bpmn-io/element-template-chooser). To review the changes of a template update or migration, plug-in an [element template changelog](https://github.com/bpmn-io/element-template-changelog).

### Checking updates

Check which user input a template change loses, for example in template linting or before you publish a new version:

```javascript
import { checkUpdate } from 'bpmn-js-element-templates/check-update';

// [ { type: 'drop' | 'invalidate', binding, label?, value?, message } ]
const findings = checkUpdate(oldTemplate, newTemplate);
```

The check follows the [update paths](https://github.com/bpmn-io/element-templates/blob/main/docs/LIFE_CYCLE.md#update-paths) declared by the new template. It does not detect changes in what a value means: no findings does not mean an update is safe.

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
