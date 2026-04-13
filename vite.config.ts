import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        health: resolve(__dirname, 'health.html'),
        exercises: resolve(__dirname, 'exercises.html'),
        savings: resolve(__dirname, 'savings.html'),
      },
    },
  },
});
