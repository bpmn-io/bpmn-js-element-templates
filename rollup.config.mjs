import alias from '@rollup/plugin-alias';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';

import {
  readFileSync
} from 'fs';

const pkg = importPkg();

const nonbundledDependencies = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
const nonExternalDependencies = [ 'preact-markup' ];

export default [
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
    external: externalDependencies(),
    plugins: pgl([
      copy({
        targets: [
          { src: 'assets/*.css', dest: 'dist/assets' }
        ]
      })
    ])
  },
  {
    input: 'src/core.js',
    output: [
      {
        sourcemap: true,
        format: 'commonjs',
        file: 'dist/core.js'
      },
      {
        sourcemap: true,
        format: 'esm',
        file: 'dist/core.esm.js'
      }
    ],
    external: externalDependencies(),
    plugins: corePlugins()
  }
];

function pgl(plugins = []) {
  return corePlugins([
    ...plugins,
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
  ]);
}

function corePlugins(plugins = []) {
  return [
    ...plugins,
    replace({
      preventAssignment: true,
      values: {
        'process.env.PKG_VERSION': JSON.stringify(pkg.version)
      }
    }),
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

function externalDependencies() {
  return id => {
    return nonbundledDependencies.find(dep => id.startsWith(dep)) &&
      !nonExternalDependencies.find(dep => id.startsWith(dep));
  };
}

function importPkg() {
  return JSON.parse(readFileSync('./package.json', { encoding:'utf8' }));
}