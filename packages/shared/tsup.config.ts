import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'format-date': 'src/format-date.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      // The dts build emits in one pass and can't use the base tsconfig's
      // incremental mode; ignoreDeprecations covers the baseUrl option that
      // tsup itself injects, deprecated as of TypeScript 6.
      incremental: false,
      ignoreDeprecations: '6.0',
    },
  },
  sourcemap: true,
  clean: true,
});
