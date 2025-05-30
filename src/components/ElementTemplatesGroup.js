import {
  ArrowIcon,
  CreateIcon,
  DropdownButton,
  HeaderButton,
  useLayoutState
} from '@bpmn-io/properties-panel';

import classnames from 'classnames';

import {
  useService
} from 'bpmn-js-properties-panel';

import { getTemplateId as defaultGetTemplateId } from '../element-templates/Helper';

import {
  getVersionOrDateFromTemplate
} from '../utils/templateUtil';


/**
 * @typedef {NoTemplate|KnownTemplate|UnknownTemplate|OutdatedTemplate} TemplateState
 */

/**
 * @typedef NoTemplate
 * @property {'NO_TEMPLATE'} type
 *
 * @typedef KnownTemplate
 * @property {'KNOWN_TEMPLATE'} type
 * @property {object} template
 *
 * @typedef UnknownTemplate
 * @property {'UNKNOWN_TEMPLATE'} type
 * @property {string} templateId
 *
 * @typedef OutdatedTemplate
 * @property {'OUTDATED_TEMPLATE'} type
 * @property {object} template
 * @property {object} newerTemplate
 */

/**
 * Factory to create an element templates group.
 *
 * @param {object} [props]
 * @param {function} [props.getTemplateId]
 * @param {function} [props.unlinkTemplate]
 * @param {function} [props.updateTemplate]
 */
export function createElementTemplatesGroup(props = {}) {

  const {
    getTemplateId = defaultGetTemplateId
  } = props;

  return function ElementTemplatesGroup(props) {
    const {
      id,
      label,
      element,
      entries = []
    } = props;

    const [ open, setOpen ] = useLayoutState(
      [ 'groups', id, 'open' ],
      false
    );

    const empty = !entries.length;

    const toggleOpen = () => !empty && setOpen(!open);

    return <div class="bio-properties-panel-group bio-properties-panel-templates-group" data-group-id={ 'group-' + id }>
      <div class={ classnames(
        'bio-properties-panel-group-header',
        {
          empty,
          open: open && !empty
        }
      ) } onClick={ toggleOpen }
      >
        <div title={ label } class="bio-properties-panel-group-header-title">
          { label }
        </div>

        <div class="bio-properties-panel-group-header-buttons">
          <TemplateGroupButtons
            element={ element }
            getTemplateId={ getTemplateId } />
          { !empty && <SectionToggle open={ open } /> }
        </div>
      </div>

      <div class={ classnames(
        'bio-properties-panel-group-entries',
        { open: open && !empty }
      ) }>
        {
          entries.map(entry => {
            const {
              component: Component,
              id
            } = entry;

            return (
              <Component
                { ...entry }
                key={ id }
                element={ element } />
            );
          })
        }
      </div>
    </div>;
  };

}

function SectionToggle({ open }) {
  return <HeaderButton
    title="Toggle section"
    class="bio-properties-panel-arrow"
  >
    <ArrowIcon class={ open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right' } />
  </HeaderButton>;
}


/**
 *
 * @param {object} props
 * @param {object} props.element
 * @param {function} props.getTemplateId
 * @param {function} props.unlinkTemplate
 * @param {function} props.updateTemplate
 */
function TemplateGroupButtons({ element, getTemplateId }) {
  const elementTemplates = useService('elementTemplates');

  const templateState = getTemplateState(elementTemplates, element, getTemplateId);

  if (templateState.type === 'NO_TEMPLATE') {
    return <SelectEntryTemplate element={ element } />;
  } else if (templateState.type === 'KNOWN_TEMPLATE') {
    return <AppliedTemplate element={ element } />;
  } else if (templateState.type === 'UNKNOWN_TEMPLATE') {
    return <UnknownTemplate element={ element } />;
  } else if (templateState.type === 'DEPRECATED_TEMPLATE') {
    return <DeprecatedTemplate element={ element } templateState={ templateState } />;
  } else if (templateState.type === 'INCOMPATIBLE_TEMPLATE') {
    return <IncompatibleTemplate element={ element } />;
  } else if (templateState.type === 'OUTDATED_TEMPLATE') {
    return (
      <OutdatedTemplate
        element={ element }
        templateState={ templateState } />
    );
  }
}

function SelectEntryTemplate({ element }) {
  const translate = useService('translate');
  const eventBus = useService('eventBus');

  const selectTemplate = () => eventBus.fire('elementTemplates.select', { element });

  return (
    <HeaderButton
      title="Select a template"
      class="bio-properties-panel-select-template-button"
      onClick={ selectTemplate }
    >
      <CreateIcon />
      <span>{ translate('Select') }</span>
    </HeaderButton>
  );
}

function AppliedTemplate({ element }) {
  const translate = useService('translate'),
        elementTemplates = useService('elementTemplates');

  const menuItems = [
    { entry: translate('Unlink'), action: () => elementTemplates.unlinkTemplate(element) },
    { entry: <RemoveTemplate />, action: () => elementTemplates.removeTemplate(element) }
  ];

  return (
    <DropdownButton menuItems={ menuItems } class="bio-properties-panel-applied-template-button">
      <HeaderButton>
        <span>{ translate('Applied') }</span>
        <ArrowIcon class="bio-properties-panel-arrow-down" />
      </HeaderButton>
    </DropdownButton>
  );
}

function RemoveTemplate() {
  const translate = useService('translate');

  return <span class="bio-properties-panel-remove-template">{ translate('Remove') }</span>;
}

function UnknownTemplate({ element }) {
  const translate = useService('translate'),
        elementTemplates = useService('elementTemplates');

  const menuItems = [
    { entry: <NotFoundText /> },
    { separator: true },
    { entry: translate('Unlink'), action: () => elementTemplates.unlinkTemplate(element) },
    { entry: <RemoveTemplate />, action: () => elementTemplates.removeTemplate(element) }
  ];

  return (
    <DropdownButton menuItems={ menuItems } class="bio-properties-panel-template-not-found">
      <HeaderButton>
        <span>{ translate('Not found') }</span>
        <ArrowIcon class="bio-properties-panel-arrow-down" />
      </HeaderButton>
    </DropdownButton>
  );
}

function NotFoundText() {
  const translate = useService('translate');

  return (
    <div class="bio-properties-panel-template-not-found-text">
      { translate(
        'The template applied was not found. Therefore, its properties cannot be shown. Unlink to access the data.'
      ) }
    </div>
  );
}

/**
 *
 * @param {object} props
 * @param {object} element
 * @param {UnknownTemplate} templateState
 * @param {function} unlinkTemplate
 * @param {function} updateTemplate
 */
function OutdatedTemplate({ element, templateState }) {
  const { newerTemplate, compatible } = templateState;

  const translate = useService('translate'),
        elementTemplates = useService('elementTemplates');

  const menuItems = [
    { entry: <UpdateAvailableText newerTemplate={ newerTemplate } compatible={ compatible } /> },
    { separator: true },
    { entry: translate('Update'), action: () => elementTemplates.applyTemplate(element, newerTemplate) },
    { entry: translate('Unlink'), action: () => elementTemplates.unlinkTemplate(element) },
    { entry: <RemoveTemplate />, action: () => elementTemplates.removeTemplate(element) }
  ];

  const cls = compatible
    ? 'bio-properties-panel-template-update-available'
    : 'bio-properties-panel-template-incompatible';

  const text = compatible
    ? translate('Update available')
    : translate('Incompatible');

  return (
    <DropdownButton menuItems={ menuItems } class={ cls }>
      <HeaderButton>
        <span>{ text }</span>
        <ArrowIcon class="bio-properties-panel-arrow-down" />
      </HeaderButton>
    </DropdownButton>
  );
}

function UpdateAvailableText({ newerTemplate, compatible }) {
  const translate = useService('translate');

  const text = compatible
    ? translate(
      'A new version of the template is available: {templateVersion}',
      { templateVersion: getVersionOrDateFromTemplate(newerTemplate) }
    )
    : translate(
      'A version of this template is available that supports your environment: {templateVersion}',
      { templateVersion: getVersionOrDateFromTemplate(newerTemplate) }
    );

  return <div class="bio-properties-panel-template-update-available-text">{text}</div>;
}

function DeprecatedTemplate({ element, templateState }) {
  const { template } = templateState;

  const translate = useService('translate'),
        elementTemplates = useService('elementTemplates');

  const menuItems = [
    { entry: <DeprecationWarning template={ template } /> },
    { separator: true },
    { entry: translate('Unlink'), action: () => elementTemplates.unlinkTemplate(element) },
    { entry: <RemoveTemplate />, action: () => elementTemplates.removeTemplate(element) }
  ];

  return (
    <DropdownButton menuItems={ menuItems } class="bio-properties-panel-deprecated-template-button">
      <HeaderButton>
        <span>{ translate('Deprecated') }</span>
        <ArrowIcon class="bio-properties-panel-arrow-down" />
      </HeaderButton>
    </DropdownButton>
  );
}

function DeprecationWarning({ template }) {
  const translate = useService('translate');

  const {
    message = translate('This template is deprecated.'),
    documentationRef
  } = template.deprecated;

  return <div class="bio-properties-panel-deprecated-template-text">
    {message}
    {documentationRef && <>&nbsp;<a href={ documentationRef }><DocumentationIcon /></a></>}
  </div>;
}

function DocumentationIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M10.6368 10.6375V5.91761H11.9995V10.6382C11.9995 10.9973 11.8623 11.3141 11.5878 11.5885C11.3134 11.863 10.9966 12.0002 10.6375 12.0002H1.36266C0.982345 12.0002 0.660159 11.8681 0.396102 11.6041C0.132044 11.34 1.52588e-05 11.0178 1.52588e-05 10.6375V1.36267C1.52588e-05 0.98236 0.132044 0.660173 0.396102 0.396116C0.660159 0.132058 0.982345 2.95639e-05 1.36266 2.95639e-05H5.91624V1.36267H1.36266V10.6375H10.6368ZM12 0H7.2794L7.27873 1.36197H9.68701L3.06507 7.98391L4.01541 8.93425L10.6373 2.31231V4.72059H12V0Z" fill="#818798" />
  </svg>;
}

function IncompatibleTemplate({ element }) {
  const translate = useService('translate'),
        elementTemplates = useService('elementTemplates');

  const menuItems = [
    { entry: <IncompatibleText /> },
    { separator: true },
    { entry: translate('Unlink'), action: () => elementTemplates.unlinkTemplate(element) },
    { entry: <RemoveTemplate />, action: () => elementTemplates.removeTemplate(element) }
  ];

  return (
    <DropdownButton menuItems={ menuItems } class="bio-properties-panel-template-incompatible">
      <HeaderButton>
        <span>{ translate('Incompatible') }</span>
        <ArrowIcon class="bio-properties-panel-arrow-down" />
      </HeaderButton>
    </DropdownButton>
  );
}

function IncompatibleText() {
  const translate = useService('translate');

  return (
    <div class="bio-properties-panel-template-incompatible-text">
      { translate(
        'No compatible version of this template was found for your environment. Unlink to access the template’s data.'
      ) }
    </div>
  );
}


// helper //////

/**
 * Determine template state in the current element.
 *
 * @param {object} elementTemplates
 * @param {object} element
 * @param {function} getTemplateId
 * @returns {TemplateState}
 */
function getTemplateState(elementTemplates, element, getTemplateId) {
  const templateId = getTemplateId(element),
        template = elementTemplates.get(element);

  if (!templateId) {
    return { type: 'NO_TEMPLATE' };
  }

  if (!template) {
    return { type: 'UNKNOWN_TEMPLATE', templateId };
  }

  if (template.deprecated) {
    return { type: 'DEPRECATED_TEMPLATE', template };
  }

  const compatible = elementTemplates.isCompatible(template);

  const latestTemplate = elementTemplates.getLatest(templateId, { deprecated: true })[0];

  if (latestTemplate && latestTemplate !== template) {
    return { type: 'OUTDATED_TEMPLATE', template, newerTemplate: latestTemplate, compatible };
  }

  if (!compatible) {
    return { type: 'INCOMPATIBLE_TEMPLATE', template };
  }

  return { type: 'KNOWN_TEMPLATE', template };
}
