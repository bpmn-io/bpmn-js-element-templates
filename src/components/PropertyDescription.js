import Markup from 'preact-markup';
import { useService } from 'bpmn-js-properties-panel';

import { sanitizeHTML } from '../utils/sanitize';

{ /* Required to break up imports, see https://github.com/babel/babel/issues/15156 */ }

export function PropertyDescription(props) {
  const {
    description
  } = props;

  const translate = useService('translate');

  return description && (
    <Markup
      markup={ sanitizeHTML(translate(description)) }
      trim={ false } />
  );
}