import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify('AIzaSyBlx4PIJOXVe-AHq01ZY1VC7ntkiYUPz_A'),
        'process.env.GEMINI_API_KEY': JSON.stringify('AIzaSyBlx4PIJOXVe-AHq01ZY1VC7ntkiYUPz_A')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
