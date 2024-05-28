import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { TextFieldEntry } from '@bpmn-io/properties-panel';
import { propertyGetter, propertySetter, propertyValidator } from './util';

export function StringProperty(props) {
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
    placeholder,
    tooltip
  } = property;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        debounce = useService('debounceInput'),
        translate = useService('translate');

  return TextFieldEntry({
    debounce,
    element,
    getValue: propertyGetter(element, property),
    id,
    label,
    feel,
    placeholder,
    description: PropertyDescription({ description }),
    setValue: propertySetter(bpmnFactory, commandStack, element, property),
    validate: propertyValidator(translate, property),
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
