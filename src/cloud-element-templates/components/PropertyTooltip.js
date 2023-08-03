import Markup from 'preact-markup';

import { sanitizeHTML } from '../../element-templates/util/sanitize';

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