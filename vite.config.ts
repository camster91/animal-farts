import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

// Deployed at root path under a Coolify subdomain.
export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    // Expose package.json version to client code (used by ParentApp for "what's new" toast)
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(
      JSON.parse(fs.readFileSync('./package.json', 'utf-8')).version
    ),
  },
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
