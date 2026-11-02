import { defineConfig } from 'vite';

// GitHub Pages serves the site from https://<user>.github.io/Game-Prototype/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Game-Prototype/' : '/',
}));
