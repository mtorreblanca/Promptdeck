import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createLlmMiddleware } from "./server/router.js";
import { providerConfigFromEnv } from "./server/complete.js";

function llmApiPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const read = (key) => env[key] || process.env[key];

  const middleware = createLlmMiddleware((provider) => providerConfigFromEnv(provider, read));

  return {
    name: "llm-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), llmApiPlugin(mode)],
}));
