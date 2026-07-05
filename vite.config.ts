import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  // Allow tunneled hosts (e.g. cloudflared *.trycloudflare.com) to reach the
  // dev server so webhooks and pages work through a public tunnel.
  server: {
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
  },
  plugins: [
    adonisjs({
      /**
       * Where Vite writes its bundle + manifest. Must match `buildDirectory`
       * in config/vite.ts (the runtime reader). Kept in a dedicated `vite/`
       * subfolder because the plugin empties this dir on every build, and our
       * hand-written design system lives in the sibling `public/assets`.
       */
      buildDirectory: 'public/assets/vite',

      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entrypoints: ['resources/css/app.css', 'resources/js/app.js'],

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ],
})
