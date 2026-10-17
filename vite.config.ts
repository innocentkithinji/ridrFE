import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { signInProblem } from "./src/config/sign-in.ts";

export default defineConfig(({ mode }) => {
  const problem = signInProblem(mode, loadEnv(mode, process.cwd(), "VITE_"));
  if (problem) {
    throw new Error(problem);
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    // MapLibre loads lazily; listing it here stops the dev server from
    // discovering it on first use and reloading the page.
    optimizeDeps: { include: ["maplibre-gl"] },
    server: { port: Number(process.env.PORT) || 5173, strictPort: true },
    build: {
      // Screens load per route (src/app/routes), so the first download is
      // small. MapLibre can't be split further: its chunk (about 1 MB) and
      // its worker (about 0.5 MB) load only when a map shows. The limit
      // sits just above MapLibre, so a chunk bigger than it still warns.
      chunkSizeWarningLimit: 1100,
      // Libraries change less often than the app, so browsers keep them
      // cached across releases.
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
              { name: "api", test: /node_modules[\\/](@ridr|@bufbuild|@connectrpc|@tanstack)[\\/]/ },
              { name: "ui", test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react)[\\/]/ },
              { name: "charts", test: /node_modules[\\/](uplot)[\\/]/ },
              { name: "map", test: /node_modules[\\/](maplibre-gl|@maplibre)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
