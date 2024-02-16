import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { TextAreaEntry } from '@bpmn-io/properties-panel';
import {
  propertyGetter,
  propertySetter,
  propertyValidator
} from './util';

export function TextAreaProperty(props) {
  const {
    element,
    id,
    property
  } = props;

  const {
    description,
    editable,
    label,
    feel,
    language,
    tooltip
  } = property;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        debounce = useService('debounceInput'),
        translate = useService('translate');

  return TextAreaEntry({
    debounce,
    element,
    id,
    label,
    feel,
    monospace: !!language,
    autoResize: true,
    description: PropertyDescription({ description }),
    getValue: propertyGetter(element, property),
    setValue: propertySetter(bpmnFactory, commandStack, element, property),
    validate: propertyValidator(translate, property),
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
