package com.gsbdevs.sbnotas;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Plugin nativo "Updater": auto-update do Android SEM Play Store. Baixa o APK de uma URL (ex.: um
 * asset do GitHub Releases) e dispara a instalação pelo instalador do sistema (o usuário confirma).
 *
 * A UI web não sabe de nada disso — fala com a casca via Platform.checkForUpdate() (capacitor.ts),
 * que compara a versão instalada com um manifesto e, se houver versão nova, chama downloadAndInstall.
 * O progresso do download vem por evento ("downloadProgress"). Requisitos no manifest:
 * REQUEST_INSTALL_PACKAGES + o usuário habilitar "instalar apps desconhecidos" (Android 8+). O APK
 * novo precisa ter a MESMA assinatura do instalado. Ver nativeUpdater.ts / docs 15.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    static final String TAG = "SBNotasUpdater";

    /** Versão instalada (versionName + versionCode) para comparar com o manifesto. */
    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pi = pm.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? pi.getLongVersionCode() : pi.versionCode;
            JSObject ret = new JSObject();
            ret.put("version", pi.versionName == null ? "" : pi.versionName);
            ret.put("code", code);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("getVersion falhou: " + e.getMessage());
        }
    }

    /** O usuário já permitiu que o SB Notas instale apps? (Android 8+; abaixo disso é sempre true.) */
    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            granted = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /** Abre a tela do sistema "Instalar apps desconhecidos" já no nosso app. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("openInstallSettings falhou: " + e.getMessage());
        }
    }

    /**
     * Baixa o APK de `url` para o cache e lança o instalador do sistema. Progresso em "downloadProgress"
     * ({percent}). Download numa thread à parte para não travar o bridge.
     */
    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url obrigatória");
            return;
        }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists()) dir.mkdirs();
                File apk = new File(dir, "update.apk");
                if (apk.exists()) //noinspection ResultOfMethodCallIgnored
                    apk.delete();

                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);
                conn.connect();
                int status = conn.getResponseCode();
                if (status / 100 != 2) {
                    call.reject("download HTTP " + status);
                    return;
                }
                int total = conn.getContentLength();
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[16384];
                    long read = 0;
                    int n, lastPct = -1;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        read += n;
                        if (total > 0) {
                            int pct = (int) (read * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject p = new JSObject();
                                p.put("percent", pct);
                                notifyListeners("downloadProgress", p);
                            }
                        }
                    }
                    out.flush();
                }

                // Lança o instalador do sistema (ACTION_VIEW + mime de APK) via FileProvider.
                Uri uri = FileProvider.getUriForFile(getContext(),
                        getContext().getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(install);
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "downloadAndInstall falhou", e);
                call.reject("downloadAndInstall falhou: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }
}
