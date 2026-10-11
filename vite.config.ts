import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The desktop app's preview assigns a free port through PORT; 5173 otherwise.
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
