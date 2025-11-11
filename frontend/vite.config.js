import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: [
      'admin-center-9.preview.emergentagent.com',
      '.emergentagent.com',
      'localhost',
      '127.0.0.1'
    ]
  }
})
