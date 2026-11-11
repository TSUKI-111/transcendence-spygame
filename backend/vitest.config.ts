import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config({
  path: '.env.test',
  override: true,
});

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  },
});
