package com.gsbdevs.sbnotas;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Recebe o disparo do AlarmManager e sobe uma notificação com FULL-SCREEN INTENT — a única forma de,
 * a partir do 2º plano (Android 10+), abrir uma Activity por cima de tudo (como o alarme do relógio).
 * A Activity (AlarmActivity) toca o som e vibra.
 */
public class AlarmReceiver extends BroadcastReceiver {

    static final String CHANNEL_ID = "sbnotas_alarm";

    private void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Alarmes de lembrete", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Disparo em tela cheia dos lembretes");
            ch.setBypassDnd(true);
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        if (title == null) title = "Lembrete";
        if (body == null) body = "";

        ensureChannel(ctx);

        Intent full = new Intent(ctx, AlarmActivity.class);
        full.putExtra("id", id);
        full.putExtra("title", title);
        full.putExtra("body", body);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fsPI = PendingIntent.getActivity(
                ctx, id, full, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setOngoing(true)
                .setFullScreenIntent(fsPI, true);

        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException ignored) {
            /* sem permissão de notificação: nada a fazer */
        }

        // Se o app estiver em 1º plano, abre a Activity direto (o full-screen intent cobre o resto).
        try {
            ctx.startActivity(full);
        } catch (Exception ignored) {
        }
    }
}
