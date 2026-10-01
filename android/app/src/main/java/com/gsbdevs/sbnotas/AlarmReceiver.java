package com.gsbdevs.sbnotas;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Recebe o disparo do AlarmManager e sobe uma notificação com FULL-SCREEN INTENT — a única forma de,
 * a partir do 2º plano (Android 10+), abrir uma Activity por cima de tudo (como o alarme do relógio).
 * A Activity (AlarmActivity) toca o som e vibra.
 */
public class AlarmReceiver extends BroadcastReceiver {

    static final String TAG = "SBNotasAlarm";
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

        boolean fsAllowed = true;
        boolean notifsOn = NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm2 = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            fsAllowed = nm2 != null && nm2.canUseFullScreenIntent();
        }
        Log.d(TAG, "onReceive: id=" + id + " (\"" + title + "\") | fullScreenPermitido=" + fsAllowed
                + " notifsOn=" + notifsOn + " sdk=" + Build.VERSION.SDK_INT);
        if (!fsAllowed) {
            Log.w(TAG, "onReceive: SEM permissão de tela cheia (Android 14+) — o alarme vai cair como "
                    + "heads-up em vez de abrir a AlarmActivity. Conceda em Ajustes → Diagnóstico.");
        }
        if (!notifsOn) {
            Log.w(TAG, "onReceive: notificações DESABILITADAS — nada será exibido.");
        }

        ensureChannel(ctx);

        Intent full = new Intent(ctx, AlarmActivity.class);
        full.putExtra("id", id);
        full.putExtra("title", title);
        full.putExtra("body", body);
        full.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fsPI = PendingIntent.getActivity(
                ctx, id, full, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_sbnotas)   // sino monocromático (fim do quadrado)
                .setColor(0xFFFACC15)                        // tint âmbar da marca
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setOngoing(true)
                .setContentIntent(fsPI)          // tocar na notificação (heads-up) também abre a tela
                .setFullScreenIntent(fsPI, true);

        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
            Log.d(TAG, "onReceive: notificação full-screen postada (id=" + id + ")");
        } catch (SecurityException e) {
            Log.e(TAG, "onReceive: SecurityException ao postar notificação (permissão?): " + e.getMessage());
        }

        // Se o app estiver em 1º plano, abre a Activity direto (o full-screen intent cobre o resto).
        try {
            ctx.startActivity(full);
            Log.d(TAG, "onReceive: startActivity(AlarmActivity) chamado");
        } catch (Exception e) {
            Log.w(TAG, "onReceive: startActivity bloqueado (background-activity-launch?): " + e.getMessage());
        }
    }
}
