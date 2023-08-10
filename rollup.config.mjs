import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';

import path from 'path';

import {
  readFileSync
} from 'fs';

const pkg = importPkg('.');
const corePkg = importPkg('./cloud-core');


function pplugins() {
  return [
    alias({
      entries: [
        { find: 'react', replacement: '@bpmn-io/properties-panel/preact/compat' },
        { find: 'preact', replacement: '@bpmn-io/properties-panel/preact' }
      ]
    }),
    babel({
      babelHelpers: 'bundled',
      plugins: [
        [ '@babel/plugin-transform-react-jsx', {
          'importSource': '@bpmn-io/properties-panel/preact',
          'runtime': 'automatic'
        } ]
      ]
    })
  ];
}

export default [
  {
    input: 'src/index.js',
    output: [
      {
        sourcemap: true,
        format: 'umd',
        file: pkg['umd:main'],
        name: 'BpmnJSElementTemplates'
      }
    ],
    plugins: pgl([
      ...pplugins()
    ])
  },
  {
    input: 'src/index.js',
    output: [
      {
        sourcemap: true,
        format: 'commonjs',
        file: pkg.main
      },
      {
        sourcemap: true,
        format: 'esm',
        file: pkg.module
      }
    ],
    external: externalDependencies(pkg),
    plugins: pgl([
      copy({
        targets: [
          { src: 'assets/*.css', dest: 'dist/assets' }
        ]
      }),
      ...pplugins()
    ])
  },
  {
    input: 'cloud-core/src/index.js',
    output: [
      {
        sourcemap: true,
        format: 'commonjs',
        file: path.join('cloud-core', corePkg.main)
      },
      {
        sourcemap: true,
        format: 'esm',
        file: path.join('cloud-core', corePkg.module)
      }
    ],
    external: externalDependencies(corePkg),
    plugins: pgl()
  }
];

function pgl(plugins = []) {
  return [
    ...plugins,
    json(),
    resolve({
      mainFields: [
        'browser',
        'module',
        'main'
      ]
    }),
    commonjs()
  ];
}

function externalDependencies(pkg) {

  const externalDependencies = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
  const bundledDependencies = [ 'preact-markup' ];

  return id => {
    return (
      externalDependencies.find(dep => id.startsWith(dep))
         && !bundledDependencies.find(dep => id.startsWith(dep))
    );
  };
}

function importPkg(base) {
  return JSON.parse(readFileSync(base + '/package.json', { encoding:'utf8' }));
}