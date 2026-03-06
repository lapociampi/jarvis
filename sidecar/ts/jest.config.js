export default {
  preset: 'ts-jest/presets/default-esm',
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      diagnostics: { ignoreCodes: [151002] },
    }],
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
