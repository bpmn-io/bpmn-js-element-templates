import { useService } from 'bpmn-js-properties-panel';

import { getVersionOrDateFromTemplate } from '../utils/templateUtil';

{ /* Required to break up imports, see https://github.com/babel/babel/issues/15156 */ }

export function TemplateProps({
  element,
  elementTemplates,
  getTemplateId,
  getTemplateVersion
}) {

  const localTemplate = elementTemplates.get(element);

  const template = localTemplate || {
    id: getTemplateId(element),
    version: getTemplateVersion(element)
  };

  // no template configured
  if (!template.id) {
    return [];
  }

  return [
    !localTemplate && {
      id: 'template-id',
      component: TemplateId,
      template
    },
    {
      id: 'template-name',
      component: TemplateName,
      template
    },
    {
      id: 'template-version',
      component: TemplateVersion,
      template
    },
    {
      id: 'template-description',
      component: TemplateDescription,
      template
    }
  ];
}

function TemplateName({ id, template }) {
  const translate = useService('translate');

  const { name } = template;

  return name
    ? <TextEntry id={ id } label={ translate('Name') } content={ name } />
    : null;
}

function TemplateId({ id, template }) {
  const translate = useService('translate');

  return <TextEntry id={ id } label={ translate('ID') } content={ template.id } />;
}

function TemplateVersion({ id, template }) {
  const translate = useService('translate');

  const version = getVersionOrDateFromTemplate(template);

  return version
    ? <TextEntry id={ id } label={ translate('Version') } content={ version } />
    : null;
}

function TemplateDescription({ id, template }) {
  const translate = useService('translate');

  const { description } = template;

  return description ?
    <TextEntry id={ id } label={ translate('Description') } content={ template.description } /> :
    null;
}

function TextEntry({ id, label, content }) {
  return <div data-entry-id={ id } class="bio-properties-panel-entry bio-properties-panel-text-entry">
    <span class="bio-properties-panel-label">{ label }</span>
    <span class="bio-properties-panel-text-entry__content">{ content }</span>
  </div>;
}
