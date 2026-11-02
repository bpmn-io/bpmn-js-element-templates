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

### Inspect Templated Elements in a Viewer

To inspect templated elements without being able to change them, use the viewer modules together with the read-only [viewer modules of the properties panel](https://github.com/bpmn-io/bpmn-js-properties-panel#inspect-properties-in-a-viewer). They do not require any editing features such as the command stack, and cannot apply, unlink or remove templates:

```javascript
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import {
  BpmnPropertiesPanelViewerModule,
  BpmnPropertiesProviderViewerModule,
  ZeebePropertiesProviderViewerModule
} from 'bpmn-js-properties-panel';

import {
  CloudElementTemplatesPropertiesProviderViewerModule // Camunda 8 Element Templates
  // ElementTemplatesPropertiesProviderViewerModule // Camunda 7 Element Templates
} from 'bpmn-js-element-templates';

import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

const viewer = new NavigatedViewer({
  container: '#canvas',
  propertiesPanel: {
    parent: '#properties'
  },
  additionalModules: [
    BpmnPropertiesPanelViewerModule,
    BpmnPropertiesProviderViewerModule,
    ZeebePropertiesProviderViewerModule,
    CloudElementTemplatesPropertiesProviderViewerModule
  ],
  moddleExtensions: {
    zeebe: zeebeModdle
  },
  elementTemplates: templates
});
```

Templates are provided via the `elementTemplates` configuration or `elementTemplates#set`, as in the editor. Use `CloudElementTemplatesCoreViewerModule` or `ElementTemplatesCoreViewerModule` for the template lookup only.

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
