# 06 — Atualização automática do app

Como uma nova versão chega aos usuários, nas duas cascas.

## Web / PWA — "só recarregar a página" ✅ (já funciona)

O `vite-plugin-pwa` está em `registerType: 'autoUpdate'` e o service worker (`src/sw.ts`) chama
`skipWaiting()` + `clients.claim()`. Fluxo:

1. Você faz o deploy do novo `dist/` (Cloudflare Pages / Netlify / GitHub Pages…).
2. Na **próxima visita ou reload**, o navegador baixa o SW novo, ele ativa na hora e a página passa
   a servir a versão nova. O usuário não instala nada — **recarregar basta**.

Nada a fazer aqui além do deploy. (Melhoria opcional futura: um toast "nova versão — recarregar"
para abas que ficam abertas por muito tempo sem reload.)

## Desktop / Tauri — atualizar de dentro do app ✅ (código pronto; falta assinar/hospedar)

O app já traz o **plugin updater**: ao abrir, o [`UpdateBanner`](../src/components/UpdateBanner.tsx)
chama `platform.checkForUpdate()`; havendo versão nova, mostra "Atualização X disponível → Instalar",
que **baixa, instala e relança** o app. Falta o que só você pode fazer (chaves + hospedagem):

### 1. Gerar o par de chaves de assinatura (uma vez)
```bash
npm run tauri signer generate -- -w src-tauri/sbnotas.key
```
- Guarde a **chave privada** (`sbnotas.key`) e a **senha** em local seguro — NÃO comite.
- Copie a **chave pública** (impressa no terminal) para `src-tauri/tauri.conf.json` em
  `plugins.updater.pubkey` (hoje está `COLE_AQUI_...`).

### 2. Apontar o endpoint
Em `plugins.updater.endpoints`, troque `SEU_USUARIO/sb-notas` pelo seu repositório (ou qualquer URL
que sirva o `latest.json`). O padrão usa a última release do GitHub.

### 3. Ligar a geração de artefatos de update
Em `src-tauri/tauri.conf.json`, dentro de `bundle`, adicione:
```json
"createUpdaterArtifacts": true
```
> Deixei isso **desligado** de propósito: com ele ligado, o `tauri build` exige a chave de assinatura
> nas variáveis de ambiente (senão falha). Ligue quando for publicar updates.

### 4. Buildar assinando
```bash
# PowerShell (Windows)
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content src-tauri/sbnotas.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "sua-senha"
npm run tauri:build
```
Gera o instalador **e** os artefatos de update + `.sig` em `src-tauri/target/release/bundle/`.

### 5. Publicar e escrever o `latest.json`
Suba o instalador na release (ex.: GitHub Releases) e publique um `latest.json` no endpoint:
```json
{
  "version": "0.2.0",
  "notes": "Correções e melhorias",
  "pub_date": "2026-08-14T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<conteúdo do arquivo .sig gerado>",
      "url": "https://github.com/SEU_USUARIO/sb-notas/releases/download/v0.2.0/SB-Notas_0.2.0_x64-setup.exe"
    }
  }
}
```
Ajuste `url`/nome do artefato ao que o build gerou. Para cada release nova: **bump da `version`** em
`tauri.conf.json` (e `package.json`), rebuild assinado, novo `latest.json`.

### Automatizado (recomendado) — GitHub Actions

Já existe o workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml). Com ele,
lançar uma atualização vira **três passos**:

1. Bump da `version` em `src-tauri/tauri.conf.json` e `package.json`.
2. `git commit` + `git tag v0.2.0` + `git push origin v0.2.0`.
3. Pronto: o CI builda, **assina**, cria a Release e sobe o instalador + `latest.json`. O app dos
   usuários pega sozinho.

**Configurar uma vez** — Secrets do repo (Settings → Secrets and variables → Actions):
| Secret | Valor |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | conteúdo do `sbnotas.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | a senha da chave (vazio se não definiu) |
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publishable do Supabase |
| `VITE_VAPID_PUBLIC_KEY` | chave pública VAPID (Web Push) |

> O workflow liga o `createUpdaterArtifacts` **só no CI** (via `--config
> src-tauri/tauri.conf.release.json`), então seu `tauri build` local segue sem exigir a chave.
> Se o CI não gerar o `latest.json`, o plano B é pôr `"createUpdaterArtifacts": true` direto no
> `bundle` do `tauri.conf.json`.

### Como o usuário recebe
Abre o app → o banner aparece → clica **Instalar** → baixa, instala e reabre já atualizado. Sem
reinstalar na mão. (Se o updater não estiver configurado, `checkForUpdate()` retorna `null` e o
banner simplesmente não aparece — o app não quebra.)
