package com.atlasai.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION = 41;
    private WebView webView;
    private PermissionRequest pendingAudioRequest;
    private SharedPreferences prefs;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("atlas_mobile", MODE_PRIVATE);
        String saved = prefs.getString("server_url", "");
        if (saved.isEmpty()) showServerForm();
        else openServer(saved);
    }

    private void showServerForm() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(42, 54, 42, 42);
        layout.setBackgroundColor(0xff080e1a);

        TextView title = new TextView(this);
        title.setText("ATLAS—AI");
        title.setTextColor(0xffe8f0ff);
        title.setTextSize(30);
        layout.addView(title);

        TextView help = new TextView(this);
        help.setText("Conecta esta APK al servidor ATLAS-AI que está ejecutándose en tu computadora. Ambos dispositivos deben usar la misma red Wi-Fi. Ejemplo: http://192.168.1.100:3000");
        help.setTextColor(0xffb8c6dc);
        help.setTextSize(16);
        help.setPadding(0, 22, 0, 18);
        layout.addView(help);

        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setTextColor(0xff101827);
        address.setHint("http://192.168.1.100:3000");
        address.setText(prefs.getString("server_url", ""));
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        layout.addView(address);

        Button connect = new Button(this);
        connect.setText("Conectar con ATLAS");
        layout.addView(connect);
        connect.setOnClickListener(v -> {
            String value = address.getText().toString().trim();
            if (!validServerUrl(value)) {
                Toast.makeText(this, "Escribe una dirección http:// o https:// válida.", Toast.LENGTH_LONG).show();
                return;
            }
            prefs.edit().putString("server_url", trimSlash(value)).apply();
            openServer(trimSlash(value));
        });

        TextView note = new TextView(this);
        note.setText("La clave de OpenAI permanece en el servidor de tu computadora; esta APK no la almacena.");
        note.setTextColor(0xff8fa2bd);
        note.setPadding(0, 24, 0, 0);
        layout.addView(note);
        setContentView(layout);
    }

    private boolean validServerUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (Exception ex) { return false; }
    }

    private String trimSlash(String value) {
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }

    private void openServer(String url) {
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                Uri base = Uri.parse(url);
                if (target.getHost() != null && target.getHost().equalsIgnoreCase(base.getHost())
                    && target.getPort() == base.getPort()
                    && target.getScheme().equals(base.getScheme())) return false;
                if ("https".equals(target.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, target)); } catch (Exception ignored) {}
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                boolean secure = request.getOrigin() != null && "https".equals(request.getOrigin().getScheme());
                boolean asksAudio = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) asksAudio = true;
                }
                if (!secure || !asksAudio) { request.deny(); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    pendingAudioRequest = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION);
                }
            }
        });
        setContentView(webView);
        webView.loadUrl(url);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AUDIO_PERMISSION && pendingAudioRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                && "https".equals(pendingAudioRequest.getOrigin().getScheme())) {
                pendingAudioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else pendingAudioRequest.deny();
            pendingAudioRequest = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else new AlertDialog.Builder(this)
            .setTitle("ATLAS-AI")
            .setMessage("¿Quieres cambiar la dirección del servidor?")
            .setNegativeButton("Cancelar", (d, w) -> {})
            .setPositiveButton("Cambiar servidor", (d, w) -> showServerForm())
            .show();
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
