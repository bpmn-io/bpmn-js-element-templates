/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

export function getEnginesConfig(definitions) {
  const engines = {};

  const executionPlatform = definitions.get('modeler:executionPlatform');
  const executionPlatformVersion = definitions.get('modeler:executionPlatformVersion');

  if (executionPlatform === 'Camunda Cloud' && executionPlatformVersion) {
    engines.camunda = executionPlatformVersion;
  }

  return engines;
}
