package com.gsbdevs.sbnotas;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.app.NotificationManagerCompat;

/**
 * Tela cheia do alarme (estilo relógio). Aparece por cima de tudo, mesmo com a tela bloqueada,
 * liga a tela, toca um som de alarme em LOOP (volume de alarme, fura o silencioso) e vibra
 * continuamente até o usuário tocar em Concluir/Abrir.
 */
public class AlarmActivity extends Activity {

    private MediaPlayer player;
    private Vibrator vibrator;
    private int notifId;

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

        String title = getIntent().getStringExtra("title");
        String body = getIntent().getStringExtra("body");
        notifId = getIntent().getIntExtra("id", 0);
        if (title == null) title = "Lembrete";
        if (body == null) body = "";

        ((TextView) findViewById(R.id.alarm_title)).setText(title);
        TextView bodyView = findViewById(R.id.alarm_body);
        bodyView.setText(body);

        ((Button) findViewById(R.id.alarm_dismiss)).setOnClickListener(v -> stopAndFinish(false));
        ((Button) findViewById(R.id.alarm_open)).setOnClickListener(v -> stopAndFinish(true));

        startSound();
        startVibration();
    }

    private void startSound() {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
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

    private void stopAndFinish(boolean openApp) {
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

        if (openApp) {
            Intent i = new Intent(this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(i);
        }
        finish();
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
