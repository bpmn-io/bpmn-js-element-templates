import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

export default {
  input: 'test/migration/node.js',
  output: { file: 'test/migration-test.cjs', format: 'cjs' },
  external: [ 'assert', 'node:assert' ],
  plugins: [
    {
      name: 'bpmn-fixtures',
      transform(code, id) {
        if (id.endsWith('.bpmn')) return `export default ${JSON.stringify(code)};`;
      }
    },
    replace({
      preventAssignment: true,
      'process.env.PKG_VERSION': JSON.stringify(pkg.version)
    }),
    json(),
    resolve(),
    commonjs()
  ]
};
