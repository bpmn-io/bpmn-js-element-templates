import { without } from 'min-dash';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { TextFieldEntry } from '@bpmn-io/properties-panel';

import {
  findCamundaErrorEventDefinition,
  findExtensions
} from '../../Helper';

import { useService } from 'bpmn-js-properties-panel';


export function ErrorProperties(props) {
  const {
    element,
    index,
    property,
    groups
  } = props;

  const {
    binding,
    label
  } = property;

  const {
    errorRef
  } = binding;

  const businessObject = getBusinessObject(element),
        errorEventDefinitions = findExtensions(businessObject, [ 'camunda:ErrorEventDefinition' ]);

  if (!errorEventDefinitions.length) {
    return;
  }

  const errorEventDefinition = findCamundaErrorEventDefinition(element, errorRef);

  const id = `${ element.id }-error-${ index }`;

  let entries = [];

  const errorGroup = groups.find(({ id }) => id === 'CamundaPlatform__Errors');
  const originalItem = errorGroup.items.find(({ entries }) => entries[0].errorEventDefinition === errorEventDefinition);
  entries = originalItem.entries;

  // (1) remove global error referenced entry
  // entries.shift();
  entries = removeEntry(entries, '-errorRef');

  // (2) remove throw expression input
  // entries.pop();
  entries = removeEntry(entries, '-expression');

  // (3) add disabled throw expression input
  entries.push({
    id: `${ id }-expression`,
    component: Expression,
    errorEventDefinition,
    property
  });

  const item = {
    id,
    label: label || getErrorLabel(errorEventDefinition),
    entries
  };

  return item;
}

function Expression(props) {
  const {
    errorEventDefinition,
    id
  } = props;

  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = () => {};

  const getValue = () => {
    return errorEventDefinition.get('camunda:expression');
  };

  return TextFieldEntry({
    element: errorEventDefinition,
    id,
    label: translate('Throw expression'),
    getValue,
    setValue,
    debounce,
    disabled: true
  });
}

function removeEntry(entries, suffix) {
  const entry = entries.find(({ id }) => id.endsWith(suffix));

  return without(entries, entry);
}

function getErrorLabel(errorEventDefinition) {
  const error = errorEventDefinition.get('errorRef');

  if (!error) {
    return '<no reference>';
  }

  const errorCode = error.get('errorCode'),
        name = error.get('name') || '<unnamed>';

  if (errorCode) {
    return `${ name } (code = ${ errorCode })`;
  }

  return name;
}
