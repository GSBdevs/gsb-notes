import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Configuração da casca Android (Capacitor). O webDir é o build do Vite (`dist`).
 * Para DEV com hot-reload no aparelho, descomente `server.url` apontando para o IP da sua máquina
 * na LAN (o mesmo host do `npm run dev`), rode `npm run dev -- --host` e depois `npm run cap:sync`.
 * Para RELEASE, mantenha `server` comentado — o app carrega os assets embarcados de `dist`.
 */
const config: CapacitorConfig = {
  appId: 'com.gsbdevs.sbnotas',
  appName: 'SB Notas',
  webDir: 'dist',
  // server: { url: 'http://192.168.0.10:5173', cleartext: true },
  backgroundColor: '#0A0A0B',
  plugins: {
    LocalNotifications: {
      // Ícone monocromático da barra de status (adicione em android/app/src/main/res quando gerar).
      smallIcon: 'ic_stat_sbnotas',
      iconColor: '#FACC15',
    },
  },
}

export default config
