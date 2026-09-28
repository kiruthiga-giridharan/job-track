import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Kept separate from vite.config.ts so tests don't load the Figma Make dev plugins.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 30000,
  },
})
