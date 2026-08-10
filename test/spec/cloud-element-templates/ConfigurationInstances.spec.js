import { expect } from 'chai';
import { spy } from 'sinon';

import ConfigurationInstances from 'src/cloud-element-templates/core/ConfigurationInstances';

import { EventBus } from '../mocks';


describe('provider/cloud-element-templates - ConfigurationInstances', function() {

  it('should return only instances compatible with the template and version', function() {

    // given
    const configurationInstances = createConfigurationInstances();

    configurationInstances.setSelectableInstances([ {
      name: 'compatible',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:slack-connection:1',
        configurationTemplateVersion: 2
      }
    }, {
      name: 'incompatible',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:slack-connection:1',
        configurationTemplateVersion: 1
      }
    }, {
      name: 'other-template',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:aws-connection:1',
        configurationTemplateVersion: 2
      }
    }, {
      name: 'plain-variable',
      metadata: {
        configurationTemplate: 'io.camunda:slack-connection:1',
        configurationTemplateVersion: 2
      }
    }, {
      name: 'unversioned',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:slack-connection:1'
      }
    } ]);

    // when
    const instances = configurationInstances.getSelectableByConfigurationTemplate('io.camunda:slack-connection:1', 2);

    // then
    expect(instances.map(({ name }) => name)).to.eql([ 'compatible' ]);
  });


  it('should notify listeners when the host updates instance state', function() {

    // given
    const eventBus = new EventBus();
    const configurationInstances = createConfigurationInstances(eventBus);
    const changedSpy = spy();

    eventBus.on('configurationInstances.changed', changedSpy);

    // when
    configurationInstances.setLoading(true);

    // then
    expect(configurationInstances.isLoading()).to.be.true;
    expect(changedSpy).to.have.been.calledOnce;
    expect(changedSpy).to.have.been.calledWith({
      selectableInstances: [],
      loading: true,
      error: false,
      clusterSelected: false,
      permissions: {
        create: false,
        update: false
      }
    });

    // when
    configurationInstances.setState({
      selectableInstances: [ {
        name: 'slack-production',
        metadata: {
          kind: 'CREDENTIAL',
          configurationTemplate: 'io.camunda:slack-connection:1',
          configurationTemplateVersion: 2
        }
      } ],
      loading: false,
      error: false,
      clusterSelected: true,
      permissions: {
        create: true,
        update: true
      }
    });

    // then
    expect(configurationInstances.getSelectableInstances()).to.have.length(1);
    expect(configurationInstances.isLoading()).to.be.false;
    expect(configurationInstances.hasError()).to.be.false;
    expect(configurationInstances.isClusterSelected()).to.be.true;
    expect(configurationInstances.canCreate()).to.be.true;
    expect(configurationInstances.canUpdate()).to.be.true;
    expect(changedSpy).to.have.been.calledTwice;
    expect(changedSpy).to.have.been.calledWith({
      selectableInstances: configurationInstances.getSelectableInstances(),
      loading: false,
      error: false,
      clusterSelected: true,
      permissions: {
        create: true,
        update: true
      }
    });

    // when
    configurationInstances.setState({ error: true });

    // then
    expect(configurationInstances.hasError()).to.be.true;

    // when
    configurationInstances.setState({ clusterSelected: false });

    // then
    expect(configurationInstances.hasError()).to.be.false;
    expect(configurationInstances.canCreate()).to.be.false;
    expect(configurationInstances.canUpdate()).to.be.false;
  });


  it('should get a referenced instance by name', function() {

    // given
    const configurationInstances = createConfigurationInstances();
    const instance = {
      name: 'slack-production',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:slack-connection:1',
        configurationTemplateVersion: 2
      }
    };

    configurationInstances.setState({
      referencedInstances: [ instance ],
      clusterSelected: true
    });

    // then
    expect(configurationInstances.getReferencedInstanceByName('slack-production')).to.equal(instance);
    expect(configurationInstances.getReferencedInstanceByName('missing')).not.to.exist;
  });


  it('should keep a referenced instance out of selectable instances', function() {

    // given
    const configurationInstances = createConfigurationInstances();
    const resolvedInstance = {
      name: 'slack-production',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:slack-connection:1',
        configurationTemplateVersion: 1
      }
    };

    configurationInstances.setState({
      selectableInstances: [],
      referencedInstances: [ resolvedInstance ],
      clusterSelected: true
    });

    // then
    expect(configurationInstances.getReferencedInstanceByName('slack-production')).to.equal(resolvedInstance);
    expect(configurationInstances.getSelectableInstances()).to.be.empty;
  });


  it('should check whether an instance is compatible', function() {

    // given
    const configurationInstances = createConfigurationInstances();
    const instance = {
      name: 'slack-production',
      metadata: {
        kind: 'CREDENTIAL',
        configurationTemplate: 'io.camunda:slack-connection:1',
        configurationTemplateVersion: 2
      }
    };

    // then
    expect(configurationInstances.isCompatible(instance, 'io.camunda:slack-connection:1', 2)).to.be.true;
    expect(configurationInstances.isCompatible(instance, 'io.camunda:slack-connection:1', 3)).to.be.false;
    expect(configurationInstances.isCompatible(instance, 'io.camunda:aws-connection:1', 2)).to.be.false;
  });


  it('should support any template-derived configuration kind', function() {

    // given
    const configurationInstances = createConfigurationInstances();
    const templateDerivedInstance = {
      name: 'shared-connection',
      metadata: {
        kind: 'CONNECTION',
        configurationTemplate: 'io.camunda:shared-connection:1',
        configurationTemplateVersion: 1
      }
    };
    const plainVariable = {
      name: 'plain-variable',
      metadata: {
        configurationTemplate: 'io.camunda:shared-connection:1',
        configurationTemplateVersion: 1
      }
    };

    // then
    expect(configurationInstances.isCompatible(templateDerivedInstance, 'io.camunda:shared-connection:1', 1)).to.be.true;
    expect(configurationInstances.isCompatible(plainVariable, 'io.camunda:shared-connection:1', 1)).to.be.false;
  });

});


function createConfigurationInstances(eventBus = new EventBus()) {
  return new ConfigurationInstances(eventBus);
}