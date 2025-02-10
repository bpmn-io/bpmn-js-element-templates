import { getLabel, setLabel } from 'bpmn-js/lib/features/label-editing/LabelUtil';
import { getShapeIdFromPlane, isPlane } from 'bpmn-js/lib/util/DrilldownUtil';
import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

export default class RemoveElementTemplateHandler {
  constructor(
      modeling,
      elementFactory,
      elementRegistry,
      canvas,
      bpmnFactory,
      replace,
      commandStack
  ) {
    this._modeling = modeling;
    this._elementFactory = elementFactory;
    this._elementRegistry = elementRegistry;
    this._canvas = canvas;
    this._bpmnFactory = bpmnFactory;
    this._replace = replace;
    this._commandStack = commandStack;
  }

  preExecute(context) {
    const {
      element
    } = context;

    if (element.parent) {
      context.newElement = this._removeTemplate(element);
    } else {
      context.newElement = this._removeRootTemplate(element);
    }
  }

  _removeTemplate(element) {
    const replace = this._replace;

    const businessObject = getBusinessObject(element);

    const type = businessObject.$type,
          eventDefinitionType = this._getEventDefinitionType(businessObject);

    const newBusinessObject = this._createBlankBusinessObject(element);

    return replace.replaceElement(element,
      {
        type: type,
        businessObject: newBusinessObject,
        eventDefinitionType: eventDefinitionType,
      },
      {
        createElementsBehavior: false
      }
    );
  }

  /**
   * Remove template from a given element.
   *
   * @param {djs.model.Base} element
   *
   * @return {djs.model.Base} the updated element
   */
  _removeRootTemplate(element) {
    var modeling = this._modeling,
        elementFactory = this._elementFactory,
        elementRegistry = this._elementRegistry,
        canvas = this._canvas;

    // We are inside a collapsed subprocess, move up to the parent before replacing the collapsed object
    if (isPlane(element)) {
      const shapeId = getShapeIdFromPlane(element);
      const shape = elementRegistry.get(shapeId);

      if (shape && shape !== element) {
        canvas.setRootElement(canvas.findRoot(shape));
        return this._removeTemplate(shape);
      }
    }

    const businessObject = getBusinessObject(element);

    const type = businessObject.$type;

    const newBusinessObject = this._createBlankBusinessObject(element);

    const newRoot = elementFactory.create('root', {
      type: type,
      businessObject: newBusinessObject
    });

    this._commandStack.execute('canvas.updateRoot', {
      newRoot: newRoot,
      oldRoot: element
    });

    modeling.moveElements(element.children, { x: 0, y: 0 }, newRoot);

    return newRoot;
  }

  _getEventDefinitionType(businessObject) {
    if (!businessObject.eventDefinitions) {
      return null;
    }

    const eventDefinition = businessObject.eventDefinitions[ 0 ];

    if (!eventDefinition) {
      return null;
    }

    return eventDefinition.$type;
  }

  _createBlankBusinessObject(element) {
    const bpmnFactory = this._bpmnFactory;

    const bo = getBusinessObject(element),
          newBo = bpmnFactory.create(bo.$type),
          label = getLabel(element);

    if (!label) {
      return newBo;
    }

    if (is(element, 'bpmn:Group')) {
      newBo.categoryValueRef = bpmnFactory.create('bpmn:CategoryValue');
    }

    setLabel({ businessObject: newBo }, label);

    return newBo;
  }
}


RemoveElementTemplateHandler.$inject = [
  'modeling',
  'elementFactory',
  'elementRegistry',
  'canvas',
  'bpmnFactory',
  'replace',
  'commandStack'
];
