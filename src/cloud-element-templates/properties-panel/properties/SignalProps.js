import {
  getBusinessObject
} from 'bpmn-js/lib/util/ModelUtil';

import {
  sortBy
} from 'min-dash';

import { isSelectEntryEdited } from '@bpmn-io/properties-panel';
import ReferenceSelect from '../../../entries/ReferenceSelect';

import { useService } from 'bpmn-js-properties-panel';

import {
  getSignal,
  getSignalEventDefinition,
  isSignalSupported
} from '../../../utils/EventDefinitionUtil';

import {
  createElement,
  findRootElementById,
  findRootElementsByType,
  getRoot,
  nextId
} from '../../../utils/ElementUtil';

export const EMPTY_OPTION = '';
export const CREATE_NEW_OPTION = 'create-new';


/**
 * @typedef { import('@bpmn-io/properties-panel').EntryDefinition } Entry
 */

/**
 * @returns {Array<Entry>} entries
 */
export function SignalProps(props) {
  const {
    element
  } = props;

  if (!isSignalSupported(element)) {
    return [];
  }

  return [
    {
      id: 'signalRef',
      component: SignalRef,
      isEdited: isSelectEntryEdited
    }
  ];
}

function SignalRef(props) {
  const { element } = props;

  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const translate = useService('translate');

  const signalEventDefinition = getSignalEventDefinition(element);

  const getValue = () => {
    const signal = getSignal(element);

    if (signal) {
      return signal.get('id');
    }

    return EMPTY_OPTION;
  };

  const setValue = (value) => {
    const root = getRoot(signalEventDefinition);

    let signal;

    // (1) create new signal
    if (value === CREATE_NEW_OPTION) {
      const id = nextId('Signal_');

      signal = createElement(
        'bpmn:Signal',
        { id, name: id },
        root,
        bpmnFactory
      );

      value = signal.get('id');
    }

    // (2) update (or remove) signalRef
    signal = findRootElementById(signalEventDefinition, 'bpmn:Signal', value) || signal;

    // (3) commit all updates
    return modeling.updateModdleProperties(element, signalEventDefinition, {
      signalRef: signal
    });
  };

  const getOptions = () => {

    let options = [
      { value: EMPTY_OPTION, label: translate('<none>') },
      { value: CREATE_NEW_OPTION, label: translate('Create new ...') }
    ];

    const signals = findRootElementsByType(getBusinessObject(element), 'bpmn:Signal');

    const filteredSignals = withoutTemplatedSignals(signals);

    sortByName(filteredSignals).forEach(signal => {
      options.push({
        value: signal.get('id'),
        label: signal.get('name')
      });
    });

    return options;
  };

  return ReferenceSelect({
    element,
    id: 'signalRef',
    label: translate('Global signal reference'),
    autoFocusEntry: 'signalName',
    getValue,
    setValue,
    getOptions
  });
}

function withoutTemplatedSignals(signals) {
  return signals.filter(signal => !signal.get('zeebe:modelerTemplate'));
}


// helper /////////////////////////

function sortByName(elements) {
  return sortBy(elements, e => (e.name || '').toLowerCase());
}
