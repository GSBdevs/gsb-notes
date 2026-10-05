package com.gsbdevs.sbnotas;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin nativo "Alarm": agenda um alarme estilo relógio (tela cheia + som + vibração) via
 * AlarmManager.setAlarmClock (exato, imune ao Doze, mostra o ícone de alarme na barra). O disparo
 * cai no AlarmReceiver, que abre a AlarmActivity. Ver AlarmReceiver/AlarmActivity.
 *
 * Diagnóstico (logcat, tag "SBNotasAlarm"): schedule/cancel/fireNow logam; getInfo() devolve o
 * estado (SDK, permissão de tela cheia, notificações habilitadas, alarme exato) para os Ajustes.
 */
@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    static final String TAG = "SBNotasAlarm";

    private PendingIntent pendingIntentFor(int id, String noteId, String title, String body,
                                           String color, String priority, int snoozeMin, String soundUri,
                                           String accent) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.gsbdevs.sbnotas.ALARM_" + id);
        intent.putExtra("id", id);
        intent.putExtra("noteId", noteId);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("color", color);
        intent.putExtra("priority", priority);
        intent.putExtra("snoozeMin", snoozeMin);
        intent.putExtra("soundUri", soundUri);
        intent.putExtra("accent", accent);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, id, intent, flags);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        // IMPORTANTE: `at` é epoch ms (~1.79e12), grande demais p/ int — o org.json guarda como Long e
        // `call.getDouble` devolve 0 nesse caso. Ler via optLong no JSObject trata Long corretamente.
        int id = call.getData().optInt("id", 0);
        String noteId = call.getString("noteId", "");
        long at = call.getData().optLong("at", 0L);
        String title = call.getString("title", "Lembrete");
        String body = call.getString("body", "");
        String color = call.getString("color", "");
        String priority = call.getString("priority", "normal");
        int snoozeMin = call.getData().optInt("snoozeMin", 10);
        String soundUri = call.getString("soundUri", "");
        // Cor de destaque do app (tema do usuário): colore cabeçalho/ações da tela cheia. Difere de
        // `color` (cor do lembrete, só na borda do card). Vazio → âmbar padrão no nativo.
        String accent = call.getString("accent", "");
        if (id == 0 || at <= 0) {
            Log.w(TAG, "schedule REJEITADO: id/at inválidos (id=" + id + ", at=" + at + ")");
            call.reject("id/at inválidos");
            return;
        }

        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            Log.e(TAG, "schedule REJEITADO: AlarmManager indisponível");
            call.reject("AlarmManager indisponível");
            return;
        }

        PendingIntent fire = pendingIntentFor(id, noteId, title, body, color, priority, snoozeMin, soundUri, accent);
        // showIntent: o que abre ao tocar no ícone de alarme da barra de status (abre o app).
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent showIntent = PendingIntent.getActivity(
                ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(at, showIntent);
        am.setAlarmClock(info, fire); // exato + à prova de Doze; não exige permissão especial
        long deltaMs = at - System.currentTimeMillis();
        Log.d(TAG, "schedule OK: id=" + id + " em " + (deltaMs / 1000) + "s (\"" + title + "\") | "
                + "fullScreen=" + canFullScreen() + " notifsOn=" + notificationsEnabled());
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        int id = call.getData().optInt("id", 0);
        if (id == 0) {
            call.resolve();
            return;
        }
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pendingIntentFor(id, "", "", "", "", "normal", 10, "", ""));
        Log.d(TAG, "cancel: id=" + id);
        call.resolve();
    }

    /**
     * DIAGNÓSTICO: abre a tela do alarme AGORA (app em 1º plano). Isola "a Activity/som/tela cheia
     * funciona?" do agendamento. O caminho de 2º plano (sistema → AlarmReceiver) é testado pelo
     * botão "Alarme em 15s" (schedule real via AlarmManager).
     */
    @PluginMethod
    public void fireNow(PluginCall call) {
        int id = call.getData().optInt("id", 999999);
        String title = call.getString("title", "Teste de alarme");
        String body = call.getString("body", "Disparo imediato (diagnóstico)");
        Context ctx = getContext();
        // App está em 1º plano ao tocar o botão → abre a AlarmActivity direto (teste confiável da
        // tela/som/vibração). O caminho de 2º plano (sistema → AlarmReceiver) é testado pelo agendado.
        Intent full = new Intent(ctx, AlarmActivity.class);
        full.putExtra("id", id);
        full.putExtra("title", title);
        full.putExtra("body", body);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Log.d(TAG, "fireNow: abrindo AlarmActivity direto (id=" + id + ")");
        ctx.startActivity(full);
        call.resolve();
    }

    /** Abre o seletor de toques do sistema (TYPE_ALARM): sons de alarme embutidos + custom. */
    @PluginMethod
    public void pickSound(PluginCall call) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Som do alarme");
        String current = call.getString("currentUri", "");
        if (current != null && !current.isEmpty()) {
            try {
                intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(current));
            } catch (Exception ignored) {
            }
        }
        startActivityForResult(call, intent, "pickSoundResult");
    }

    @ActivityCallback
    private void pickSoundResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject o = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK) {
            o.put("cancelled", true);
            o.put("uri", (String) null);
            o.put("name", "");
            call.resolve(o);
            return;
        }
        Uri uri = null;
        if (result.getData() != null) {
            uri = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        }
        if (uri != null) {
            o.put("uri", uri.toString());
            String name = "Som personalizado";
            try {
                Ringtone r = RingtoneManager.getRingtone(getContext(), uri);
                if (r != null) name = r.getTitle(getContext());
            } catch (Exception ignored) {
            }
            o.put("name", name);
        } else {
            // "Padrão do sistema" selecionado
            o.put("uri", (String) null);
            o.put("name", "Padrão do sistema");
        }
        call.resolve(o);
    }

    /** DIAGNÓSTICO: estado do dispositivo para os Ajustes (e logcat). */
    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject o = new JSObject();
        o.put("sdkInt", Build.VERSION.SDK_INT);
        o.put("manufacturer", Build.MANUFACTURER);
        o.put("model", Build.MODEL);
        o.put("canUseFullScreenIntent", canFullScreen());
        o.put("notificationsEnabled", notificationsEnabled());
        o.put("canScheduleExactAlarms", canScheduleExact());
        o.put("canDrawOverlays", canDrawOverlays());
        o.put("isIgnoringBatteryOptimizations", isIgnoringBattery());
        Log.d(TAG, "getInfo: " + o);
        call.resolve(o);
    }

    /** Abre a tela do sistema para tirar o app da otimização de bateria (ou os detalhes do app). */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception e2) {
                Log.w(TAG, "openBatterySettings falhou: " + e2.getMessage());
            }
        }
        call.resolve();
    }

    /** App está isento da otimização de bateria? (Doze/standby não seguram o alarme.) */
    private boolean isIgnoringBattery() {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    /** DIAGNÓSTICO: abre a tela do sistema para conceder "Aparecer sobre outros apps" (overlay). */
    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            Log.w(TAG, "openOverlaySettings falhou: " + e.getMessage());
        }
        call.resolve();
    }

    /** Overlay ("Aparecer sobre outros apps"): permite iniciar a AlarmActivity do 2º plano c/ tela ligada. */
    private boolean canDrawOverlays() {
        return Settings.canDrawOverlays(getContext());
    }

    /** DIAGNÓSTICO: abre a tela do sistema para o usuário conceder "notificação em tela cheia". */
    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        Context ctx = getContext();
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                i.setData(Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } else {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            }
        } catch (Exception e) {
            Log.w(TAG, "openFullScreenSettings falhou: " + e.getMessage());
        }
        call.resolve();
    }

    private boolean canFullScreen() {
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && nm.canUseFullScreenIntent();
        }
        return true; // antes do Android 14 é sempre permitido
    }

    private boolean notificationsEnabled() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private boolean canScheduleExact() {
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            return am != null && am.canScheduleExactAlarms();
        }
        return true;
    }
}
