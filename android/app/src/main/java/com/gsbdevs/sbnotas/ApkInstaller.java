package com.gsbdevs.sbnotas;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Plugin nativo mínimo para o auto-update por APK. Recebe o caminho (file://) do APK já baixado
 * pelo lado web (Filesystem), transforma num content:// via FileProvider e abre o instalador do
 * Android (ACTION_VIEW + mime de APK). Precisa da permissão REQUEST_INSTALL_PACKAGES no manifesto;
 * na 1ª vez o SO pede "permitir instalar desta fonte" — comportamento normal de APK sideloaded.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstaller extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Caminho do APK ausente");
            return;
        }
        try {
            String filePath = Uri.parse(path).getPath();
            File apk = new File(filePath);
            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao abrir o instalador: " + e.getMessage());
        }
    }
}
