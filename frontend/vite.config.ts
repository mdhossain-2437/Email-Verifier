import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Split the bundle so the initial download stays small and the chart
// library only loads for users who land on the dashboard.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor-react"
            if (id.includes("react/") || id.endsWith("/react/index.js")) return "vendor-react"
            if (id.includes("scheduler")) return "vendor-react"
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts"
            if (id.includes("lucide-react")) return "vendor-icons"
            return "vendor"
          }
        },
      },
    },
  },
})

