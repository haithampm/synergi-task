import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const readLinkedSupabaseProjectRef = () => {
  const configPath = path.resolve(__dirname, "supabase/config.toml");

  try {
    const content = fs.readFileSync(configPath, "utf8");
    const match = content.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
};

const linkedSupabaseProjectRef = readLinkedSupabaseProjectRef();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  define: {
    __SUPABASE_LINKED_PROJECT_REF__: JSON.stringify(linkedSupabaseProjectRef),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes(`${path.sep}node_modules${path.sep}react${path.sep}`) ||
              id.includes(`${path.sep}node_modules${path.sep}react${path.sep}index.js`) ||
              id.includes(`${path.sep}node_modules${path.sep}react-dom${path.sep}`) ||
              id.includes(`${path.sep}node_modules${path.sep}scheduler${path.sep}`)
            ) {
              return "react-core";
            }
            if (id.includes("recharts")) return "charts";
            if (id.includes("@radix-ui")) return "radix-ui";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react-router")) return "router";
            if (id.includes("@tanstack")) return "react-query";
            if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "forms";
            if (id.includes("date-fns") || id.includes("react-day-picker")) return "dates";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("react-markdown")) return "markdown";
            if (
              id.includes("sonner") ||
              id.includes("cmdk") ||
              id.includes("embla-carousel-react") ||
              id.includes("input-otp") ||
              id.includes("next-themes") ||
              id.includes("react-resizable-panels") ||
              id.includes("vaul")
            ) {
              return "workspace-ui";
            }
            if (
              id.includes("clsx") ||
              id.includes("class-variance-authority") ||
              id.includes("tailwind-merge") ||
              id.includes("tailwindcss-animate")
            ) {
              return "ui-utils";
            }
            return "vendor";
          }
        },
      },
    },
  },
}));
