import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    host: true
  },
  preview: {
    port: 8080,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: false,
      },
      mangle: {
        keep_classnames: true,
        keep_fnames: true,
      }
    },
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Simple, safe chunking: one vendor chunk for node_modules and small app chunks
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/src/pages/')) return 'pages';
          if (id.includes('/src/components/')) return 'components';
        }
      }
    }
  }
})
