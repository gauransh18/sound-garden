import { defineConfig } from 'vite';

// 5174, so it can run next to Doodle Pond on 5173.
export default defineConfig({
  server: { port: 5174 },
});
