import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://retrohodl.xyz",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory", inlineStylesheets: "never" },
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
