import { useService } from 'bpmn-js-properties-panel';
import { PropertyDescription } from '../../../../components/PropertyDescription';
import { PropertyTooltip } from '../../components/PropertyTooltip';
import {
  FeelTextAreaEntryWithVariableContext,
  FeelTextAreaEntry
} from '../../../../entries/FeelEntryWithContext';
import { propertyGetter, propertySetter, propertyValidator, isExternalProperty } from './util';

export function FeelTextAreaProperty(props) {
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

  const TextAreaComponent = !isExternalProperty(property)
    ? FeelTextAreaEntryWithVariableContext
    : FeelTextAreaEntry;

  return TextAreaComponent({
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
