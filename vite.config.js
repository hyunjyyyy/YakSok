import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],

  server: {
    proxy: {
      // '/api'로 시작하는 모든 요청을 target 주소로 보냅니다.
      '/api': {
        target: 'https://b07590104546.ngrok-free.app',
        // 다른 도메인으로 요청을 보낼 때 필요한 설정입니다.
        changeOrigin: true,
        // '/api'라는 경로를 제거하고 실제 서버에 요청합니다.
        rewrite: (path) => path.replace(/^\/api/, ''),
        // SSL 인증서 관련 문제를 방지하는 설정입니다.
        secure: false,
      },
      '/csv': {
        target: 'https://b07590104546.ngrok-free.app ',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

