# Changelog

All notable changes to [bpmn-js-element-templates](https://github.com/bpmn-io/bpmn-js-element-templates) are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

## 2.16.0

* `FEAT`: support signal events ([#201](https://github.com/bpmn-io/bpmn-js-element-templates/pull/201))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.14.0`

## 2.15.1

* `FIX`: ensure FEEL expression is enforced for `feel: required` properties ([#202](https://github.com/bpmn-io/bpmn-js-element-templates/pull/202))
* `FIX`: prevent JSDoc comments from being removed ([#200](https://github.com/bpmn-io/bpmn-js-element-templates/pull/200))

## 2.15.0

* `FEAT`: add `elementTemplates#getCompatible` ([#189](https://github.com/bpmn-io/bpmn-js-element-templates/pull/189))

## 2.14.0

* `FEAT`: support `activeElementsCollection` property on `zeebe:adHoc` ([camunda/element-templates-json-schema#198](https://github.com/camunda/element-templates-json-schema/pull/198), [#186](https://github.com/bpmn-io/bpmn-js-element-templates/pull/186))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.13.0`

## 2.13.0

* `FEAT`: create sub-processes as expanded elements ([#185](https://github.com/bpmn-io/bpmn-js-element-templates/pull/185))

## 2.12.0

* `FEAT`: cache templates between linter plugin usages ([#179](https://github.com/bpmn-io/bpmn-js-element-templates/pull/179))

## 2.11.0

* `FEAT`: support `zeebe:adHoc` binding property ([#175](https://github.com/bpmn-io/bpmn-js-element-templates/pull/175))
* `FEAT`: support `zeebe:taskSchedule` binding property ([#173](https://github.com/bpmn-io/bpmn-js-element-templates/pull/173))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.12.0`
* `DEPS`: update to `bpmn-moddle@9.0.3`
* `DEPS`: update to `zeebe-bpmn-moddle@1.11.0`

## 2.10.0

* `FEAT`: support `zeebe:priorityDefinition` binding property ([#171](https://github.com/bpmn-io/bpmn-js-element-templates/pull/171))

## 2.9.1

* `FIX`: use default values for displaying edited marker ([#170](https://github.com/bpmn-io/bpmn-js-element-templates/pull/170))

## 2.9.0

* `FEAT`: support `zeebe:assignmentDefinition` binding property
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.9.0`

## 2.8.0

* `FEAT`: support `bindingType` property ([#165](https://github.com/bpmn-io/bpmn-js-element-templates/pull/165))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.7.0`

## 2.7.0

* `FEAT`: support properties of type `bpmn:Expression` ([#161](https://github.com/bpmn-io/bpmn-js-element-templates/pull/161))
* `FEAT`: support `zeebe:formDefinition` binding property ([#158](https://github.com/bpmn-io/bpmn-js-element-templates/pull/158))
* `FEAT`: support `zeebe:calledDecision` binding property ([#155](https://github.com/bpmn-io/bpmn-js-element-templates/pull/155))
* `FEAT`: support `zeebe:scriptTask` binding property ([#156](https://github.com/bpmn-io/bpmn-js-element-templates/pull/156))
* `FIX`: correctly handle numeric conditions ([#69](https://github.com/bpmn-io/bpmn-js-element-templates/issues/69))
* `FIX`: keep groups closed when template is first applied ([#162](https://github.com/bpmn-io/bpmn-js-element-templates/pull/162))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.6.0`

## 2.6.0

* `FEAT`: support `zeebe:userTask` binding property ([#147](https://github.com/bpmn-io/bpmn-js-element-templates/pull/147))
* `FIX`: correctly reuse `bpmn:Message` properties when changing templates ([#154](https://github.com/bpmn-io/bpmn-js-element-templates/pull/154))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.4.0`

## 2.5.4

* `FIX`: disable default Camunda user task implementation in templates ([#159](https://github.com/bpmn-io/bpmn-js-element-templates/pull/159))

## 2.5.3

* `FIX`: keep documentation and execution listeners when template is removed ([#120](https://github.com/bpmn-io/bpmn-js-element-templates/pull/120))
* `FIX`: do not remove unrelated properties on linkedResource update ([#143](https://github.com/bpmn-io/bpmn-js-element-templates/pull/143))
* `DEPS`: bump to `@bpmn-io/extract-process-variables@1.0.1`
* `CHORE`: separate remove behavior for C7 and C8 ([#120](https://github.com/bpmn-io/bpmn-js-element-templates/pull/120))
* `CHORE`: update modeling dev dependencies

## 2.5.2

_Reverts the breaking changes introduced via [camunda/element-templates-json-schema#156](https://github.com/camunda/element-templates-json-schema/pull/156). Any `feel` value out of the supported enum is allowed, but `static` is used if the property is missing._

* `FIX`: make `feel` default value `static` for inputs and outputs ([#142](https://github.com/bpmn-io/bpmn-js-element-templates/pull/142))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.3.3`

## 2.5.1

* `FIX`: require `feel` to be `optional` or `static` for `Boolean` and `Number` inputs and outputs ([camunda/element-templates-json-schema#156](https://github.com/camunda/element-templates-json-schema/pull/156))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.3.2`

## 2.5.0

* `FEAT`: support binding type `zeebe:linkedResource` ([#137](https://github.com/bpmn-io/bpmn-js-element-templates/issues/137))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.3.0`
* `DEPS`: update to `zeebe-bpmn-moddle@1.8.0`

## 2.4.0

* `FEAT`: support element templates runtime compatibility ([#132](https://github.com/bpmn-io/bpmn-js-element-templates/pull/132))
* `FIX`: move template selector right below documentation group ([#130](https://github.com/bpmn-io/bpmn-js-element-templates/pull/130))
* `DEPS`: update to `@bpmn-io/element-templates-validator@2.2.0`
* `DEPS`: update to `bpmnlint@10.3.1`

## 2.3.0

_No user visible changes._

* `DEPS`: bump to `@bpmn-io/extract-process-variables@1.0.0`

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

