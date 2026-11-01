package nl.wdhertog.dice;

import android.app.Activity;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayDeque;
import java.util.Locale;

/**
 * Hosts the 3D dice app (web/ folder, bundled into assets/www) in a WebView and
 * adds what the web part can't do reliably by itself: shake detection via the
 * accelerometer, vibration and keeping the screen on.
 */
public class MainActivity extends Activity implements SensorEventListener {

    // Shake = at least SHAKE_PEAKS acceleration peaks above SHAKE_G within SHAKE_WINDOW_MS.
    private static final float SHAKE_G = 1.9f;
    private static final int SHAKE_PEAKS = 2;
    private static final long SHAKE_WINDOW_MS = 900;
    private static final long SHAKE_COOLDOWN_MS = 1200;

    private WebView webView;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Vibrator vibrator;

    private final ArrayDeque<Long> peaks = new ArrayDeque<>();
    private long lastPeak = 0;
    private long lastShake = 0;
    private float maxG = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(0x16, 0x3F, 0x32));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        if (accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        }
    }

    @Override
    protected void onPause() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        webView.evaluateJavascript("window.__onBack ? window.__onBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float x = event.values[0], y = event.values[1], z = event.values[2];
        float g = (float) Math.sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH;
        long now = SystemClock.elapsedRealtime();

        if (g > SHAKE_G) {
            if (now - lastPeak > 80) {
                peaks.addLast(now);
                lastPeak = now;
            }
            maxG = Math.max(maxG, g);
        }
        while (!peaks.isEmpty() && now - peaks.peekFirst() > SHAKE_WINDOW_MS) peaks.removeFirst();

        if (peaks.size() >= SHAKE_PEAKS && now - lastShake > SHAKE_COOLDOWN_MS) {
            lastShake = now;
            peaks.clear();
            String js = String.format(Locale.US, "window.__onShake && window.__onShake(%.2f)", maxG);
            maxG = 0;
            webView.evaluateJavascript(js, null);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    /** Methods callable from JavaScript as window.AndroidBridge.*. */
    private class Bridge {
        /** pattern: comma separated durations in ms ("40" or "0,30,70,30"). */
        @JavascriptInterface
        public void vibrate(String pattern) {
            if (vibrator == null || !vibrator.hasVibrator()) return;
            try {
                String[] parts = pattern.split(",");
                long[] timings = new long[parts.length];
                for (int i = 0; i < parts.length; i++) timings[i] = Long.parseLong(parts[i].trim());
                if (timings.length == 1) {
                    vibrator.vibrate(VibrationEffect.createOneShot(Math.max(1, timings[0]), VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
                }
            } catch (RuntimeException ignored) {
                // Bad input or vibrator unavailable: vibration is optional.
            }
        }
    }
}
