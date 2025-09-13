import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    open: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        app: 'app.html'
      }
    }
  }
});


