import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			"/health": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});
