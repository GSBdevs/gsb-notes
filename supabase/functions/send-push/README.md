# send-push — notificações de app por FCM (Android)

Entrega as notificações de app (contato adicionado, DM, edição, tarefa concluída) no Android
**mesmo com o app fechado**. Sem isto, essas notificações só aparecem com o app aberto (o WebView
congela em 2º plano e o Realtime cai). Fluxo:

```
INSERT em notifications / dm_messages
   → trigger fcm_dispatch (migração 0027, pg_net)
   → POST nesta Edge Function (send-push)
   → resolve destinatário + tokens (fcm_tokens)
   → FCM HTTP v1 → aparelho Android mostra a notificação
```

O cliente registra o token FCM ao logar (`src/components/PushRegistrar.tsx` →
`saveNativePushToken` → tabela `fcm_tokens`).

## Setup (uma vez) — feito pelo DONO

### 1. Firebase
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com) (ou use um existente).
2. **Adicionar app → Android**, package name **`com.gsbdevs.sbnotas`**.
3. Baixe o **`google-services.json`** e coloque em **`android/app/google-services.json`**
   (o `android/app/build.gradle` já aplica o plugin `com.google.gms.google-services` quando ele existe).
4. Configurações do projeto → **Contas de serviço** → **Gerar nova chave privada** → baixa um
   `service-account.json` (é o mesmo projeto; NÃO comitar).

### 2. Migração
Rode `supabase/migrations/0027_fcm_push.sql` no SQL Editor (depois de 0001→0026).
Depois configure a URL + segredo do dispatcher (valores seus; o secret é escolhido por você):

```sql
insert into private.push_config (id, url, secret) values (
  1,
  'https://<SEU-REF>.supabase.co/functions/v1/send-push',
  '<UM-SEGREDO-ALEATÓRIO>'
) on conflict (id) do update set url = excluded.url, secret = excluded.secret;
```

### 3. Deploy da função + secrets
```bash
supabase functions deploy send-push --no-verify-jwt
supabase secrets set PUSH_SECRET='<o MESMO segredo do passo 2>'
```
(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente da função.)

Para o `FCM_SERVICE_ACCOUNT`, NÃO use `"$(cat ...)"` no Windows/PowerShell — o JSON multilinha
quebra. A função aceita **base64 do JSON** (uma linha só, sem aspas nem quebras). No PowerShell:
```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
supabase secrets set FCM_SERVICE_ACCOUNT=$b64
```
Alternativa sem CLI: **Dashboard → Edge Functions → (Secrets/Manage secrets)** → adicione
`FCM_SERVICE_ACCOUNT` com esse mesmo base64 como valor. (A função também aceita o JSON cru, mas o
base64 é à prova de shell.) Depois de setar o secret, **redeploy** a função para ela recarregar:
`supabase functions deploy send-push --no-verify-jwt`.

### 4. App Android
```bash
npm install          # traz @capacitor/push-notifications (já no package.json)
npm run cap:sync     # copia o build + instala o plugin no projeto Android
```
Depois builde no Android Studio (JDK 21 / JBR) e instale.

## Teste
1. Logue no app no aparelho (registra o token — veja no Logcat `FCM token recebido`).
2. **Feche o app** (remova dos recentes).
3. De outra conta/dispositivo: compartilhe uma nota com você, ou mande uma DM.
4. A notificação deve chegar na barra do Android com o app fechado.

Diagnóstico: Logcat filtrando `send-push` (lado servidor via `supabase functions logs send-push`)
e `[SBNotas]` / `Capacitor/Console` (cliente).

## Notas
- Mensagens `system` da DM ("você foi adicionado em…") NÃO empurram por aqui — já viram uma
  `notification` (0014) e seriam push em dobro. O trigger `fcm_on_dm` as ignora.
- Tokens mortos (app desinstalado / rotacionado) são limpos automaticamente ao receberem
  `UNREGISTERED`/404 do FCM.
- Legacy FCM foi desligado pelo Google (jun/2024) — por isso usamos **HTTP v1 + service account**.
