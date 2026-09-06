import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import path from "node:path";
import fs from "node:fs";
import { viteTransformToUnocss } from "transform-to-unocss";

const BOARDS = ["stock", "tax", "accounting"];

function getHtmlInputs() {
  const inputs = {
    main: path.resolve("index.html"),
    privacy: path.resolve("pages/privacy.html"),
  };

  for (const board of BOARDS) {
    const categoryFile = path.resolve(board, "index.html");

    if (fs.existsSync(categoryFile)) {
      inputs[board] = categoryFile;
    }

    const boardDir = path.resolve(board);

    if (!fs.existsSync(boardDir)) continue;

    for (const entry of fs.readdirSync(boardDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const postFile = path.join(boardDir, entry.name, "index.html");

      if (fs.existsSync(postFile)) {
        inputs[`${board}-${entry.name}`] = postFile;
      }
    }
  }

  return inputs;
}

export default defineConfig({
  plugins: [UnoCSS(), viteTransformToUnocss()],

  build: {
    rollupOptions: {
      input: getHtmlInputs(),
    },
  },

  server: {
    open: true,
    watch: {
      usePolling: true,
    },
    hmr: true,
  },
});
