import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createLlmMiddleware } from "./server/router.js";

function llmApiPlugin(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const read = (key) => env[key] || process.env[key];

  const getProviderConfig = (provider) => {
    switch (provider) {
      case "anthropic":
        return { apiKey: read("ANTHROPIC_API_KEY") };
      case "openai":
        return { apiKey: read("OPENAI_API_KEY"), baseUrl: read("OPENAI_BASE_URL") };
      case "gemini":
        return { apiKey: read("GEMINI_API_KEY") };
      case "deepseek":
        return { apiKey: read("DEEPSEEK_API_KEY"), baseUrl: read("DEEPSEEK_BASE_URL") };
      default:
        return {};
    }
  };

  const middleware = createLlmMiddleware(getProviderConfig);

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
