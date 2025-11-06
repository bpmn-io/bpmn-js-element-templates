import Markup from 'preact-markup';

import { sanitizeHTML } from '../../../utils/sanitize';

{ /* Required to break up imports, see https://github.com/babel/babel/issues/15156 */ }

export function PropertyTooltip(props) {

  const {
    tooltip
  } = props;

  return tooltip && (
    <Markup
      markup={ sanitizeHTML(tooltip) }
      trim={ false } />
  );
}