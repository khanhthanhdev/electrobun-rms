import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "electrobun-app",
		identifier: "com.electrobun.app",
		version: "1.0.0",
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"docs/schema/server.sql": "docs/schema/server.sql",
		},
		mac: {
			bundleCEF: false,
			codesign: false,
			notarize: false,
		},
		linux: {
			bundleCEF: true,
		},
		win: {
			bundleCEF: false,
		},
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
} satisfies ElectrobunConfig;
