import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly — some sandboxed/headless browser environments
    // can't reach Vite's default ::1-only (IPv6) loopback binding.
    host: "127.0.0.1",
  },
});
