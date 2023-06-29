# bpmn-js-element-templates

An [element templates](https://github.com/bpmn-io/element-templates) provider, previously available from [bpmn-js-properties-panel](https://github.com/bpmn-io/bpmn-js-properties-panel).

## Usage

Use this module in addition to [bpmn-js-properties-panel](https://github.com/bpmn-io/bpmn-js-properties-panel#usage).


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
