/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  server: {
    proxy: {
      // Guerrilla Mail
      '/guerrilla': {
        target: 'https://api.guerrillamail.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/guerrilla/, '')
      },
      // TempMail.lol
      '/tempmail': {
        target: 'https://api.tempmail.lol',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tempmail/, '')
      },
      // DropMail
      '/dropmail': {
        target: 'https://dropmail.me',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dropmail/, '')
      },
      // Mail.tm
      '/mailtm': {
        target: 'https://api.mail.tm',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mailtm/, '')
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
