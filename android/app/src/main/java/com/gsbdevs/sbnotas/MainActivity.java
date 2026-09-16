package com.gsbdevs.sbnotas;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins nativos próprios precisam ser registrados ANTES do super.onCreate.
        registerPlugin(ApkInstaller.class);
        super.onCreate(savedInstanceState);
    }
}
