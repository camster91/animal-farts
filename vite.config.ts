import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed at root path under a Coolify subdomain.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
