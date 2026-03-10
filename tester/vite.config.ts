import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/tester/",
    build: {
        outDir: "../backend/static_tester",
        emptyOutDir: true,
        sourcemap: true
    },
    server: {
        port: 5174,
        proxy: {
            "/chatgpt": "http://localhost:8000",
            "/api/health-check": "http://localhost:8000",
            "/api/webapp-health": "http://localhost:8000"
        },
        host: true
    }
});
