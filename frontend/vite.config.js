import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,  // Изменено на 3002 для соответствия текущему порту
    host: "0.0.0.0",
    allowedHosts: [
      "admin-center-9.preview.emergentagent.com",
      ".emergentagent.com",
      "localhost",
      "127.0.0.1",
    ],
    // Включить прокси для API запросов к бэкенду
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
