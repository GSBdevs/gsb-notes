package com.gsbdevs.sbnotas;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.app.NotificationManagerCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Tela cheia do alarme (estilo relógio), espelhando o card de disparo do Windows. Aparece por cima
 * do bloqueio, liga a tela, toca som de alarme em LOOP e vibra até o usuário Concluir/Adiar/Abrir.
 * Recebe pelo intent: title, body, color (hex do lembrete), priority, snoozeMin.
 */
public class AlarmActivity extends Activity {

    private MediaPlayer player;
    private Vibrator vibrator;
    private int notifId;
    private String title, body, color, priority, soundUri, noteId, accent;
    private int snoozeMin = 10;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d("SBNotasAlarm", "AlarmActivity.onCreate — tela cheia ABRIU");

        // Mostrar sobre o lock + ligar a tela.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_alarm);

        Intent it = getIntent();
        notifId = it.getIntExtra("id", 0);
        noteId = it.getStringExtra("noteId");
        title = orDefault(it.getStringExtra("title"), "Lembrete");
        body = orDefault(it.getStringExtra("body"), "");
        color = it.getStringExtra("color");
        priority = orDefault(it.getStringExtra("priority"), "normal");
        soundUri = it.getStringExtra("soundUri"); // reservado p/ som customizável (fase seguinte)
        snoozeMin = it.getIntExtra("snoozeMin", 10);
        accent = it.getStringExtra("accent"); // cor de destaque do app (tema do usuário)

        // Duas cores distintas: a do LEMBRETE (borda do card) e a de DESTAQUE do app (cabeçalho/ações).
        int cardColor = parseColor(color, 0xFFFACC15);
        int accentColor = parseColor(accent, 0xFFFACC15);

        // Card: fundo escuro, cantos arredondados, borda na cor do lembrete.
        GradientDrawable card = new GradientDrawable();
        card.setColor(0xFF1C1C1F);
        card.setCornerRadius(dp(16));
        card.setStroke(dp(2), cardColor);
        findViewById(R.id.alarm_card).setBackground(card);

        // Cabeçalho: quadradinho na cor de destaque com o sino escuro dentro (espelha o overlay do app).
        GradientDrawable iconBg = new GradientDrawable();
        iconBg.setColor(accentColor);
        iconBg.setCornerRadius(dp(8));
        ImageView icon = findViewById(R.id.alarm_icon);
        icon.setBackground(iconBg);
        icon.setImageTintList(ColorStateList.valueOf(0xFF0A0A0B)); // sino escuro sobre o destaque
        ((TextView) findViewById(R.id.alarm_label)).setTextColor(accentColor);

        // Botão primário (Concluir): fundo na cor de destaque, texto escuro (definido no XML).
        GradientDrawable primaryBtn = new GradientDrawable();
        primaryBtn.setColor(accentColor);
        primaryBtn.setCornerRadius(dp(12));
        findViewById(R.id.alarm_dismiss).setBackground(primaryBtn);

        ((TextView) findViewById(R.id.alarm_time)).setText(
                new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()));

        applyPriority((TextView) findViewById(R.id.alarm_priority), priority);

        ((TextView) findViewById(R.id.alarm_title)).setText(title);
        TextView bodyView = findViewById(R.id.alarm_body);
        bodyView.setText(body);
        bodyView.setVisibility(body.isEmpty() ? View.GONE : View.VISIBLE);

        TextView snoozeBtn = findViewById(R.id.alarm_snooze);
        snoozeBtn.setText("Adiar " + snoozeMin + " min");

        findViewById(R.id.alarm_dismiss).setOnClickListener(v -> complete());
        findViewById(R.id.alarm_open).setOnClickListener(v -> stopAndFinish(true));
        snoozeBtn.setOnClickListener(v -> snooze());

        startSound();
        startVibration();
    }

    private void applyPriority(TextView v, String p) {
        String label;
        int c;
        if ("urgent".equals(p)) {
            label = "Urgente";
            c = 0xFFEF4444;
        } else if ("important".equals(p)) {
            label = "Importante";
            c = 0xFFF59E0B;
        } else {
            label = "Normal";
            c = 0xFF94A3B8;
        }
        v.setText(label);
        v.setTextColor(c);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(999));
        bg.setColor((c & 0x00FFFFFF) | 0x33000000); // ~20% de opacidade da cor
        v.setBackground(bg);
    }

    private void startSound() {
        try {
            Uri uri = null;
            if (soundUri != null && !soundUri.isEmpty()) {
                try { uri = Uri.parse(soundUri); } catch (Exception ignored) { }
            }
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception ignored) {
        }
    }

    private void startVibration() {
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = {0, 800, 600};
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = repete
        } else {
            vibrator.vibrate(pattern, 0);
        }
    }

    /** Concluir: para o alarme e marca a nota como concluída no app (deep link → React). */
    private void complete() {
        stopAlarm();
        if (noteId != null && !noteId.isEmpty()) {
            openApp("sbnotas://alarm/complete?id=" + Uri.encode(noteId));
        }
        finish();
    }

    /** Adiar: para o alarme. Com noteId, reagenda no servidor (deep link); senão, re-alarme local. */
    private void snooze() {
        stopAlarm();
        if (noteId != null && !noteId.isEmpty()) {
            openApp("sbnotas://alarm/snooze?id=" + Uri.encode(noteId) + "&min=" + snoozeMin);
            finish();
        } else {
            rescheduleLocalAndFinish();
        }
    }

    /** Abre o app num deep link (Concluir/Adiar atuam no React). */
    private void openApp(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(i);
        } catch (Exception e) {
            Log.w("SBNotasAlarm", "openApp falhou: " + e.getMessage());
        }
    }

    /** Fallback (alarme de teste sem noteId): reagenda um novo disparo local em `snoozeMin` minutos. */
    private void rescheduleLocalAndFinish() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                long at = System.currentTimeMillis() + snoozeMin * 60_000L;
                Intent i = new Intent(this, AlarmReceiver.class);
                i.setAction("com.gsbdevs.sbnotas.ALARM_" + notifId);
                i.putExtra("id", notifId);
                i.putExtra("title", title);
                i.putExtra("body", body);
                i.putExtra("color", color);
                i.putExtra("priority", priority);
                i.putExtra("snoozeMin", snoozeMin);
                if (soundUri != null) i.putExtra("soundUri", soundUri);
                if (accent != null) i.putExtra("accent", accent);
                PendingIntent fire = PendingIntent.getBroadcast(this, notifId, i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                Intent open = new Intent(this, MainActivity.class);
                PendingIntent show = PendingIntent.getActivity(this, notifId, open,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
                Log.d("SBNotasAlarm", "snooze: reagendado em " + snoozeMin + " min");
            }
        } catch (Exception e) {
            Log.w("SBNotasAlarm", "snooze falhou: " + e.getMessage());
        }
        finish();
    }

    private void stopAlarm() {
        try {
            if (player != null) {
                if (player.isPlaying()) player.stop();
                player.release();
                player = null;
            }
        } catch (Exception ignored) {
        }
        if (vibrator != null) vibrator.cancel();
        NotificationManagerCompat.from(this).cancel(notifId);
    }

    private void stopAndFinish(boolean openApp) {
        stopAlarm();
        if (openApp) {
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(i);
        }
        finish();
    }

    private int parseColor(String s, int fallback) {
        if (s == null || s.isEmpty()) return fallback;
        try {
            return Color.parseColor(s);
        } catch (Exception e) {
            return fallback;
        }
    }

    private int dp(float d) {
        return (int) (getResources().getDisplayMetrics().density * d);
    }

    private static String orDefault(String s, String fb) {
        return (s == null || s.isEmpty()) ? fb : s;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            if (player != null) {
                player.release();
                player = null;
            }
        } catch (Exception ignored) {
        }
        if (vibrator != null) vibrator.cancel();
    }
}
