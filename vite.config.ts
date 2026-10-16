import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: Number(process.env.PORT) || 5173, strictPort: true },
  build: {
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
          ],
        },
      },
    },
  },
});
