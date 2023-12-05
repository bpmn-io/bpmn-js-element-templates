# Changelog

All notable changes to [bpmn-js-element-templates](https://github.com/bpmn-io/bpmn-js-element-templates) are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

## 1.9.2

* `FIX`: keep custom value on update when the condition was changed ([#32](https://github.com/bpmn-io/bpmn-js-element-templates/issues/32))
* `FIX`: do not persist empty values when no default is set ([#35](https://github.com/bpmn-io/bpmn-js-element-templates/pull/35))
* `FIX`: remove task definitions and messages if no properties are present in the template ([#35](https://github.com/bpmn-io/bpmn-js-element-templates/pull/35))

## 1.9.1

* `FIX`: disallow subscription binding for `bpmn:SendTask`
* `DEPS`: update to `@bpmn-io/element-templates-validator@1.6.1`

## 1.9.0

* `FEAT`: support `isActive` condition ([#19](https://github.com/bpmn-io/bpmn-js-element-templates/issues/19))
* `FEAT`: add conditional correlationKey rendering ([#19](https://github.com/bpmn-io/bpmn-js-element-templates/issues/19))
* `DEPS`: update to `@bpmn-io/element-templates-validator@1.6.0`


## 1.8.0

* `FEAT`: support receive and send task message templating ([#30](https://github.com/bpmn-io/bpmn-js-element-templates/pull/30))
* `DEPS`: update to `@bpmn-io/element-templates-validator@1.5.0`

## 1.7.0

* `FEAT`: support `zeebe:taskDefinition` binding ([#29](https://github.com/bpmn-io/bpmn-js-element-templates/pull/29))

## 1.6.1

* `FIX`: display multi-instance configuration in properties panel

## 1.6.0

* `FEAT`: add `zeebe:subscription` in single command ([#21](https://github.com/bpmn-io/bpmn-js-element-templates/issues/21))
* `FIX`: clean up empty `zeebe:subscription` ([#21](https://github.com/bpmn-io/bpmn-js-element-templates/issues/21))
* `DEPS`: update to `camunda-bpmn-js-behaviors@1.2.1`

## 1.5.0

* `FEAT`: support `camunda:executionListener` with `implementationType` ([#13](https://github.com/bpmn-io/bpmn-js-element-templates/issues/13))
* `FIX`: set `$parent` property when creating non-primitive properties ([#22](https://github.com/bpmn-io/bpmn-js-element-templates/pull/22))
* `DEPS`: update to `@bpmn-io/element-templates-validator@1.2.0`

## 1.4.0

* `FEAT`: visually show deprecated templates ([#11](https://github.com/bpmn-io/bpmn-js-element-templates/issues/11))
* `DEPS`: update to `@bpmn-io/element-templates-validator@1.0.0`


## 1.3.0

* `FEAT`: support tooltips in template properties and groups ([#8](https://github.com/bpmn-io/bpmn-js-element-templates/issues/8))
* `DEPS`: update to `bpmn-js-properties-panel@3.2.1`
* `DEPS`: update to `@bpmn-io/element-templates-validator@0.15.0`
* `DEPS`: update to `@bpmn.io/properties-panel@3.0.0`

## 1.2.2

* `FIX`: allow removing templates from root elements ([#7](https://github.com/bpmn-io/bpmn-js-element-templates/pull/7))
* `FIX`: allow removing default templates ([#7](https://github.com/bpmn-io/bpmn-js-element-templates/pull/7))

## 1.2.1

* `FIX`: don't lint messages ([#6](https://github.com/bpmn-io/bpmn-js-element-templates/pull/6))

## 1.2.0

* `FEAT`: add C8 Element Template Linter ([#3](https://github.com/bpmn-io/bpmn-js-element-templates/pull/3))
* `FEAT`: remove old template properties ([#4](https://github.com/bpmn-io/bpmn-js-element-templates/pull/4))

## 1.1.0

* `FEAT`: add `ElementTemplates#unlinkTemplate` and `ElementTemplates#removeTemplate` API ([bpmn-js-properties-panel#935](https://github.com/bpmn-io/bpmn-js-properties-panel/pull/935))

## 1.0.1

* `FIX`: export `CloudElementTemplatesValidator`

## 1.0.0

* initial release
