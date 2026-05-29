import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

/**
 * Extended zeebe moddle descriptor that adds configuration-related attributes
 * to `zeebe:Input` and `zeebe:Property`.
 *
 * In production this would live in `zeebe-bpmn-moddle` upstream.
 * For the prototype we merge the additional type into the descriptor.
 */
export default {
  ...ZeebeModdle,
  types: [
    ...ZeebeModdle.types,
    {
      name: 'ConfigurationTemplateSupported',
      isAbstract: true,
      extends: [ 'zeebe:Input', 'zeebe:Property' ],
      properties: [
        {
          name: 'modelerConfigurationTemplate',
          isAttr: true,
          type: 'String'
        },
        {
          name: 'modelerConfigurationName',
          isAttr: true,
          type: 'String'
        }
      ]
    }
  ]
};
