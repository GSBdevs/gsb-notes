package com.gsbdevs.sbnotas;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPlugin.class); // alarme nativo estilo relógio (ver AlarmPlugin.java)
        super.onCreate(savedInstanceState);
    }
}
