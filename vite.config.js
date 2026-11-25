import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return "vendor-supabase";
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/.test(id)) return "vendor-charts";
          return undefined;
        },
      },
    },
  },
});
