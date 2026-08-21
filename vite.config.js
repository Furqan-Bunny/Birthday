import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // `--host` on the CLI still works; this makes LAN access the default so the
  // site is reachable from phones on the same wifi.
  server: { host: true },
  preview: { host: true },
})
