import { expect } from 'chai';
import { spy } from 'sinon';

import ConfigurationInstances from 'src/cloud-element-templates/core/ConfigurationInstances';

import { EventBus } from '../mocks';


describe('provider/cloud-element-templates - ConfigurationInstances', function() {

  it('should return only instances compatible with the template and version', function() {

    // given
    const configurationInstances = createConfigurationInstances();

    configurationInstances.setInstances([ {
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
    const instances = configurationInstances.getByConfigurationTemplate('io.camunda:slack-connection:1', 2);

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
      instances: [],
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
      instances: [ {
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
    expect(configurationInstances.getAll()).to.have.length(1);
    expect(configurationInstances.isLoading()).to.be.false;
    expect(configurationInstances.hasError()).to.be.false;
    expect(configurationInstances.isClusterSelected()).to.be.true;
    expect(configurationInstances.canCreate()).to.be.true;
    expect(configurationInstances.canUpdate()).to.be.true;
    expect(changedSpy).to.have.been.calledTwice;
    expect(changedSpy).to.have.been.calledWith({
      instances: configurationInstances.getAll(),
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


  it('should get an instance by name', function() {

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

    configurationInstances.setInstances([ instance ]);

    // then
    expect(configurationInstances.getByName('slack-production')).to.equal(instance);
    expect(configurationInstances.getByName('missing')).not.to.exist;
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

});


function createConfigurationInstances(eventBus = new EventBus()) {
  return new ConfigurationInstances(eventBus);
}