import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // This makes both VITE_ and EXPO_PUBLIC_ variables available
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'EXPO_PUBLIC_'])
  
  return {
    plugins: [react()],
    server: {
      port: 3000
    },
    // Make EXPO_PUBLIC_ variables available to the client
    define: {
      'import.meta.env.EXPO_PUBLIC_FIREBASE_API_KEY': JSON.stringify(env.EXPO_PUBLIC_FIREBASE_API_KEY),
      'import.meta.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      'import.meta.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.EXPO_PUBLIC_FIREBASE_APP_ID': JSON.stringify(env.EXPO_PUBLIC_FIREBASE_APP_ID),
    }
  }
})
