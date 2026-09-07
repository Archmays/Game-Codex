import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [{
    name: "reject-retired-runtime",
    apply: "build",
    generateBundle() {
      const retired = [...this.getModuleIds()].filter(id => /\/(?:src\/game\/|games\/(?:clock-reader|multiplication-adventure|hanzi-radical-battle|english-spell-battle|pinyin-magic-battle)\/)/.test(id.replaceAll("\\", "/")));
      if (retired.length) this.error(`Retired runtime entered the production graph: ${retired.join(", ")}`);
      this.info("Retirement contract: no retired math or language runtime in the production module graph.");
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 5173,
    watch: {
      ignored: ["**/tmp/**", "**/artifacts/**", "**/test-results/**", "**/playwright-report/**"]
    }
  }
});
