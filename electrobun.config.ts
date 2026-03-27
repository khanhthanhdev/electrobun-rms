import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "S4V-NRC",
    identifier: "com.steamforvn.robotics-team",
    version: "1.0.0",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    // Electrobun's packager expects `views` to be an object even when
    // frontend assets are produced separately with Vite and copied in.
    views: {},
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
  release: {
    baseUrl:
      "https://github.com/khanhthanhdev/electrobun-rms/releases/latest/download",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
} satisfies ElectrobunConfig;
