import ConditionalBehavior from './ConditionalBehavior';
import ReplaceBehavior from './ReplaceBehavior';
import UpdatePropertiesOrderBehavior from './UpdatePropertiesOrderBehavior';
import { ReferencedElementBehavior } from './ReferencedElementBehavior';
import { GeneratedValueBehavior } from './GeneratedValueBehavior';
import { CalledElementBehavior } from './CalledElementBehavior';
import UserTaskBehavior from './UserTaskBehavior';

export default {
  __init__: [
    'elementTemplatesReplaceBehavior',
    'elementTemplatesConditionalBehavior',
    'elementTemplatesGeneratedValueBehavior',
    'elementTemplatesReferencedElementBehavior',
    'elementTemplatesUpdatePropertiesOrderBehavior',
    'elementTemplatesCalledElementBehavior',
    'elementTemplatesUserTaskBehavior'
  ],
  elementTemplatesReplaceBehavior: [ 'type', ReplaceBehavior ],
  elementTemplatesConditionalBehavior: [ 'type', ConditionalBehavior ],
  elementTemplatesGeneratedValueBehavior: [ 'type', GeneratedValueBehavior ],
  elementTemplatesReferencedElementBehavior: [ 'type', ReferencedElementBehavior ],
  elementTemplatesUpdatePropertiesOrderBehavior: [ 'type', UpdatePropertiesOrderBehavior ],
  elementTemplatesCalledElementBehavior: [ 'type', CalledElementBehavior ],
  elementTemplatesUserTaskBehavior: [ 'type', UserTaskBehavior ]
};
