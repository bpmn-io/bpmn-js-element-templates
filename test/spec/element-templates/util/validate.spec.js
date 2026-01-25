import { BpmnModdle } from 'bpmn-moddle';
import validate from 'src/element-templates/util/validate';

import { expect } from 'chai';


describe('provider/element-template - validate', function() {

  it('should return validation errors only', function() {

    // given
    const templateDescriptors = require('../fixtures/error-bindings-invalid');
    const moddle = new BpmnModdle();

    // when
    const errors = validate(templateDescriptors, moddle);

    // then
    expect(errors).to.have.length(7);

    expect(errors[ 0 ] instanceof Error).to.be.true;
  });

});