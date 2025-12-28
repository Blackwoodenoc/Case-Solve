import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    console.log('🔧 Vite Config - Loading env:', {
      mode,
      cwd: process.cwd(),
      hasGeminiKey: !!env.GEMINI_API_KEY,
      keyPreview: env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 10) + '...' : 'NOT FOUND'
    });
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
