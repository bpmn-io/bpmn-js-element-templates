import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import { FeelEntryWithVariableContext, FeelEntry } from '../../../../entries/FeelEntryWithContext';
import { propertyGetter, propertySetter, propertyValidator, isExternalProperty } from './util';

export function FeelProperty(props) {
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
    tooltip
  } = property;

  const bpmnFactory = useService('bpmnFactory'),
        commandStack = useService('commandStack'),
        debounce = useService('debounceInput'),
        translate = useService('translate');

  const TextFieldComponent = !isExternalProperty(property)
    ? FeelEntryWithVariableContext
    : FeelEntry;

  return TextFieldComponent({
    debounce,
    element,
    getValue: propertyGetter(element, property),
    id,
    label,
    feel,
    description: PropertyDescription({ description }),
    setValue: propertySetter(bpmnFactory, commandStack, element, property),
    validate: propertyValidator(translate, property),
    disabled: editable === false,
    tooltip: PropertyTooltip({ tooltip })
  });
}
