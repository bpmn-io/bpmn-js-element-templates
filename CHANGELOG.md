# Changelog

All notable changes to [bpmn-js-element-templates](https://github.com/bpmn-io/bpmn-js-element-templates) are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

## 2.2.1

* `FIX`: cast default `number` and `boolean` properties to FEEL ([#121](https://github.com/bpmn-io/bpmn-js-element-templates/pull/121))

## 2.2.0

* `FEAT`: do not apply `*length` and `pattern` validation to FEEL expressions ([#115](https://github.com/bpmn-io/bpmn-js-element-templates/pull/115))

## 2.1.0

* `FEAT`: always display execution listeners group for Zeebe ([#96](https://github.com/bpmn-io/bpmn-js-element-templates/pull/96))

## 2.0.0

* `FIX`: safely remove message when changing template ([#111](https://github.com/bpmn-io/bpmn-js-element-templates/pull/111))
* `FIX`: remove existing event definition when applying template ([#111](https://github.com/bpmn-io/bpmn-js-element-templates/pull/111))
* `CHORE`: drop UMD distribution ([#109](https://github.com/bpmn-io/bpmn-js-element-templates/issues/109))

### Breaking Changes

* We [dropped the UMD distribution](https://github.com/bpmn-io/bpmn-js-element-templates/pull/110). Consume this library using ESM.

## 1.16.0

* `FEAT`: support placeholders on String and Text properties ([#92](https://github.com/bpmn-io/bpmn-js-element-templates/issues/92))
* `DEPS`: update to `@bpmn-io/properties-panel@3.20.0`
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.1.0`

## 1.15.3

* `FIX`: correctly apply condition depending on boolean on initial load ([#74](https://github.com/bpmn-io/bpmn-js-element-templates/issues/94))

## 1.15.2

* `FIX`: add missing translate to labels ([#51](https://github.com/bpmn-io/bpmn-js-element-templates/issues/51))
* `FIX`: correct handling of negative boolean conditions ([#84](https://github.com/bpmn-io/bpmn-js-element-templates/issues/84))

## 1.15.1

* `FIX`: keep existing values when applying or upgrading element template ([#86](https://github.com/bpmn-io/bpmn-js-element-templates/pull/86))

## 1.15.0

* `FIX`: handle conflicting templates with shared bindings ([#78](https://github.com/bpmn-io/bpmn-js-element-templates/issues/78))
* `FIX`: prevent infinite loop when applying conditional template ([#78](https://github.com/bpmn-io/bpmn-js-element-templates/issues/78))
* `CHORE`: only update template properties if necessary

## 1.14.2

* `FIX`: make command registration named module to prevent duplicate command registration ([#76](https://github.com/bpmn-io/bpmn-js-element-templates/pull/76))

## 1.14.1

* `FIX`: disallow non-string values for `feel: required` properties ([#70](https://github.com/bpmn-io/bpmn-js-element-templates/issues/70))
* `DEPS`: update to @bpmn-io/element-templates-validator@2.0.1

## 1.14.0

* `FEAT`: always display `documentation` field in Camunda 7 diagrams ([#67](https://github.com/bpmn-io/bpmn-js-element-templates/pull/67))
* `FEAT`: always display `multi-instance` group in Camunda 7 diagrams ([#68](https://github.com/bpmn-io/bpmn-js-element-templates/pull/68))
* `FEAT`: allow `Boolean` and `Number` types in Camunda 8 diagrams ([#39](https://github.com/bpmn-io/bpmn-js-element-templates/issues/39), [#64](https://github.com/bpmn-io/bpmn-js-element-templates/pull/64))

## 1.13.2

* `FIX`: evaluate all chained conditions ([#49](https://github.com/bpmn-io/bpmn-js-element-templates/issues/49))

## 1.13.1

* `FIX`: expose `package.json`

## 1.13.0

* `FEAT`: validate text area and select ([#55](https://github.com/bpmn-io/bpmn-js-element-templates/issues/55))
* `FIX`: explicitly expose `dist` assets ([#57](https://github.com/bpmn-io/bpmn-js-element-templates/issues/57))

## 1.12.1

* `FIX`: correctly export the core module under `/core` ([#53](https://github.com/bpmn-io/bpmn-js-element-templates/pull/53))

## 1.12.0

* `FEAT`: separate and expose core module ([#52](https://github.com/bpmn-io/bpmn-js-element-templates/pull/52))

## 1.11.0

* `FEAT`: show documentation field for templated elements ([#50](https://github.com/bpmn-io/bpmn-js-element-templates/pull/50))

## 1.10.0

* `FEAT`: support `zeebe:calledElement` binding ([#37](https://github.com/bpmn-io/bpmn-js-element-templates/pull/37))

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
