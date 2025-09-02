import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react','react-dom'],
              ai: ['@google/genai'], // wird nur dynamisch geladen, aber für Klarheit separat
              supabase: ['@supabase/supabase-js'], // separates Vendor-Chunk für Supabase
            }
          }
        }
      },
      plugins: [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: false })],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
