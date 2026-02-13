import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env vars from .env files (Vite automatically loads .env, .env.local, .env.[mode])
    const env = loadEnv(mode, process.cwd(), '');
    return {
      server: {
        port: 3004,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.REACT_APP_SUPABASE_URL': JSON.stringify(env.REACT_APP_SUPABASE_URL),
        'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(env.REACT_APP_SUPABASE_ANON_KEY),
        'process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY': JSON.stringify(env.SUPABASE_PUBLISHABLE_DEFAULT_KEY),
        'import.meta.env.REACT_APP_SUPABASE_URL': JSON.stringify(env.REACT_APP_SUPABASE_URL),
        'import.meta.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(env.REACT_APP_SUPABASE_ANON_KEY),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.REACT_APP_SUPABASE_URL || env.VITE_SUPABASE_URL),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.REACT_APP_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY),
      },
      build: {
        target: 'es2022',
        commonjsOptions: {
          transformMixedEsModules: true,
        },
        outDir: 'dist',
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'es2022',
        },
        include: ['pdfjs-dist'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
      },
    };
});
