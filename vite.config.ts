import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [{
    name: "reject-retired-math-runtime",
    apply: "build",
    generateBundle() {
      const retired = [...this.getModuleIds()].filter(id => /\/(?:src\/game\/|games\/(?:clock-reader|multiplication-adventure)\/)/.test(id.replaceAll("\\", "/")));
      if (retired.length) this.error(`Retired Math runtime entered the production graph: ${retired.join(", ")}`);
      this.info("Retirement contract: no old Lab, Clock or Array runtime in the production module graph.");
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
