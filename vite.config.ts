import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    watch: {
      ignored: ["**/tmp/**", "**/artifacts/**", "**/test-results/**", "**/playwright-report/**"]
    }
  }
});
