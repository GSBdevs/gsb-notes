package com.gsbdevs.sbnotas;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin nativo "Alarm": agenda um alarme estilo relógio (tela cheia + som + vibração) via
 * AlarmManager.setAlarmClock (exato, imune ao Doze, mostra o ícone de alarme na barra). O disparo
 * cai no AlarmReceiver, que abre a AlarmActivity. Ver AlarmReceiver/AlarmActivity.
 */
@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    private PendingIntent pendingIntentFor(int id, String title, String body) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.gsbdevs.sbnotas.ALARM_" + id);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, id, intent, flags);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id", 0);
        Double atD = call.getDouble("at");
        long at = atD == null ? 0L : atD.longValue();
        String title = call.getString("title", "Lembrete");
        String body = call.getString("body", "");
        if (id == null || at <= 0) {
            call.reject("id/at inválidos");
            return;
        }

        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            call.reject("AlarmManager indisponível");
            return;
        }

        PendingIntent fire = pendingIntentFor(id, title, body);
        // showIntent: o que abre ao tocar no ícone de alarme da barra de status (abre o app).
        Intent open = new Intent(ctx, MainActivity.class);
        PendingIntent showIntent = PendingIntent.getActivity(
                ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(at, showIntent);
        am.setAlarmClock(info, fire); // exato + à prova de Doze; não exige permissão especial
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id", 0);
        if (id == null) {
            call.resolve();
            return;
        }
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pendingIntentFor(id, "", ""));
        call.resolve();
    }
}
