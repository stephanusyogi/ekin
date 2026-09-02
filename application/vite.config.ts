import vinext from "vinext";
import { defineConfig } from "vite";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(() => {
  return {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: ["terminal.local", "localhost"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    optimizeDeps: {
      exclude: ["mysql2", "mysql2/promise"],
    },
    ssr: {
      noExternal: [],
      external: ["mysql2", "mysql2/promise"],
    },
    plugins: [
      vinext(),
    ],
  };
});
