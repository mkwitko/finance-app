import { defineConfig } from "@kubb/core";
import { pluginClient } from "@kubb/plugin-client";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginTs } from "@kubb/plugin-ts";

// Generates types + TanStack Query hooks from the backend OpenAPI fixture (api.json,
// refreshed via the backend's `export-openapi` script). Hooks call our custom fetch
// client at `@/api/client` (injects the Bearer JWT + active-household header).
export default defineConfig({
  input: { path: "./api.json" },
  output: { path: "./src/api/generated", clean: true, barrelType: "named" },
  plugins: [
    pluginOas(),
    pluginTs({ output: { path: "types" } }),
    pluginClient({ output: { path: "clients" }, importPath: "@/api/client" }),
    pluginReactQuery({ output: { path: "hooks" }, client: { importPath: "@/api/client" } }),
  ],
});
