# 08 — Casca Android (Capacitor)

Decisão fechada: **Capacitor** para Android (Tauri segue no Windows). O mesmo app React roda dentro
de um WebView nativo; plugins do Capacitor dão os recursos de SO (notificações). Nenhuma tela muda —
a plataforma é escolhida sozinha em [`src/platform/index.ts`](../src/platform/index.ts)
(`web` · `tauri` · `capacitor`).

## O que já está no repo (feito por código)

- Dependências: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`,
  `@capacitor/local-notifications` (no `package.json`).
- [`capacitor.config.ts`](../capacitor.config.ts) — `appId: com.gsbdevs.sbnotas`, `webDir: dist`.
- [`src/platform/capacitor.ts`](../src/platform/capacitor.ts) — implementação da interface `Platform`:
  notificações **agendadas nativas** (mesmo com o app fechado — RF-06) e disparo imediato via
  `@capacitor/local-notifications`. Plugins carregados por import dinâmico (não incham o bundle web/Tauri).
- `main.tsx` desliga o service worker também sob Capacitor (evita frontend cacheado após `cap sync`).
- Scripts: `cap:add:android`, `cap:sync`, `cap:open`.

## Pré-requisitos (na sua máquina)

| Item | Observação |
|---|---|
| **Android Studio** (última) | inclui o Android SDK e o emulador |
| **JDK 17** | o Gradle do Capacitor 8 pede JDK 17 |
| **Android SDK Platform + Build-Tools** | instale pelo SDK Manager do Android Studio |
| Variável `ANDROID_HOME` | apontando para o SDK (o Studio configura) |

## Passo a passo (primeira vez)

```bash
npm install                 # garante as deps do Capacitor
npm run build               # gera dist/ (o Capacitor copia daqui)
npm run cap:add:android     # cria a pasta android/ (projeto nativo Gradle) — só na 1ª vez
npm run cap:sync            # build + copia web para android + instala plugins
npm run cap:open            # abre no Android Studio → Run ▶ num device/emulador
```

Depois de mudar o frontend, basta `npm run cap:sync` (ele já roda o build) e rodar de novo.

## Dev com hot-reload no aparelho (opcional)

1. Em [`capacitor.config.ts`](../capacitor.config.ts), descomente `server` e ponha o **IP da sua
   máquina na LAN** (o mesmo do Vite), ex.: `server: { url: 'http://192.168.0.10:5173', cleartext: true }`.
2. `npm run dev -- --host` (expõe o Vite na rede).
3. `npm run cap:sync && npm run cap:open` → o WebView carrega do Vite ao vivo.
4. **Para release, comente o `server` de novo** (senão o APK tenta buscar o dev server).

## Notificações — permissões

- **Android 13+ (`POST_NOTIFICATIONS`)**: o app pede em runtime — o `platform.requestNotificationPermission()`
  já chama `LocalNotifications.requestPermissions()`. Garanta que o app peça antes de agendar.
- **Alarme exato (Android 12+)**: para disparo no horário certo pode ser preciso
  `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` no `AndroidManifest.xml` (o plugin documenta). Sem isso, o
  SO pode atrasar/agrupar a notificação.
- O `android/` é gerado pelo `cap add` — ajustes de manifesto/ícone vivem lá (fora do controle do
  Vite). Versione a pasta `android/` quando estabilizar.

## Ícone e splash (opcional)

- `npm i -D @capacitor/assets` e `npx capacitor-assets generate` geram ícones/splash a partir de uma
  imagem-fonte. O ícone monocromático da barra de status referenciado no config é `ic_stat_sbnotas`
  (adicione em `android/app/src/main/res`).

## Distribuição

- **Debug:** Run no Android Studio instala no device.
- **Release:** Android Studio → *Build → Generate Signed Bundle/APK* (crie um keystore uma vez).
  Publicação na Play Store é um passo separado (conta de desenvolvedor).

## Pendências conhecidas

- Rodar `cap add android` na sua máquina (precisa do SDK — não dá para fazer aqui).
- Definir ícone/splash e as permissões de alarme exato no manifesto.
- **Lembrete por localização (geofencing)** entra aqui depois: `@capacitor/geolocation` +
  background/geofence (ver backlog em [`07`](07-pesquisa-apps-similares.md)).
