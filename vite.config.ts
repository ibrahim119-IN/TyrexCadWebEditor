import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    host: true,
    headers: {
      // تخفيف سياسة COEP للتطوير المحلي
      // للإنتاج، استخدم: 'require-corp' و 'same-origin'
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  optimizeDeps: {
    exclude: ['opencascade.js']
  },
  publicDir: 'public',
  assetsInclude: ['**/*.wasm', '**/*.wasm.js'],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'opencascade': ['opencascade.js']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  define: {
    global: 'globalThis'
  },
  worker: {
    format: 'es'
  }
})