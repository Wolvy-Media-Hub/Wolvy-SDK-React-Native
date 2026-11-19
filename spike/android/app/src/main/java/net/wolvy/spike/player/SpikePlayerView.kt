package net.wolvy.spike.player

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.media.MediaDrm
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Gravity
import android.view.SurfaceView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DecoderReuseEvaluation
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.analytics.AnalyticsListener
import androidx.media3.exoplayer.drm.DefaultDrmSessionManagerProvider
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

/**
 * Phase 3, step 1 of the SDK plan: can hardware-protected (Widevine L1) Wolvy video be shown in
 * this host (a native activity, a Flutter platform view, a React Native view)?
 *
 * Not the SDK. One view that does what the SDK will do at its simplest, and reports what
 * happened so a person holding the phone can tell us:
 *
 *   1. POST https://wolvy.net/api/app_render_video with the app's package name, as an SDK will.
 *   2. Play the DASH manifest with Widevine through Media3 on a secure SurfaceView, sending the
 *      CDN token and the session id as headers on every media request (as Wolvy Player does).
 *   3. Show the device's Widevine level, the decoder Media3 picked (".secure" = hardware path),
 *      the resolution, frames drawn and errors. "Copy report" copies them without any token.
 *
 * The host passes the embed URL that POST /v1/videos/{id}/playback-tokens returns
 * (https://embed.wolvy.stream/{video}/{base64 account}?vt=…); the view takes the three values
 * from it. The host sets FLAG_SECURE on its window.
 */
@OptIn(UnstableApi::class)
class SpikePlayerView(context: Context, private val host: String) : FrameLayout(context) {

    companion object {
        const val API = "https://wolvy.net/api"
        const val SDK_HEADER = "wolvy-android-spike/0.1.0"
        const val SD_MAX_HEIGHT = 480
    }

    private val main = Handler(Looper.getMainLooper())
    private val playerView = PlayerView(context)
    private val info = TextView(context)
    private val diag = LinkedHashMap<String, String>()
    private val errors = ArrayList<String>()
    private var player: ExoPlayer? = null
    private var trackSelector: DefaultTrackSelector? = null
    private var embedUrl: String? = null
    private var cap480 = false
    private var seenByEye = "not answered"
    private var released = false

    init {
        setBackgroundColor(Color.BLACK)
        playerView.useController = true
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
        // Before the surface exists: a secure SurfaceView cannot be captured (screenshots,
        // recordings, and a texture-based compositor all see black).
        (playerView.videoSurfaceView as? SurfaceView)?.setSecure(true)
        addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        info.setTextColor(Color.WHITE)
        info.textSize = 11f
        info.setBackgroundColor(Color.argb(170, 0, 0, 0))
        info.setPadding(16, 12, 16, 12)
        val scroll = ScrollView(context).apply { addView(info) }
        addView(scroll, LayoutParams(LayoutParams.MATCH_PARENT, dp(190), Gravity.TOP))

        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL; setBackgroundColor(Color.argb(200, 0, 0, 0)) }
        fun btn(label: String, onClick: () -> Unit) = Button(context).apply {
            text = label; isAllCaps = false; textSize = 12f; setOnClickListener { onClick() }
        }.also { row.addView(it) }
        btn("I see moving video") { seenByEye = "YES, moving video visible"; render() }
        btn("Black / no picture") { seenByEye = "NO, black or frozen"; render() }
        btn("Copy report") { copyReport() }
        btn("HD ↔ 480p") { cap480 = !cap480; applyCap(); render() }
        btn("Reload") { embedUrl?.let { start(it) } }
        val bar = HorizontalScrollView(context).apply { addView(row) }
        addView(bar, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM).apply { bottomMargin = dp(56) })

        readWidevine()
        diag["host"] = host
        diag["app id"] = context.packageName
        diag["device"] = "${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
        render()
    }

    /** Starts (or restarts) playback from an embed URL with a vt. */
    fun start(url: String) {
        embedUrl = url
        released = false
        releasePlayer()
        errors.clear()
        listOf("endpoint", "platform", "app_only_l3", "cdn host", "video format", "decoder", "first frame",
            "frames drawn", "dropped", "position", "drm").forEach { diag.remove(it) }
        val parsed = parseEmbed(url)
        if (parsed == null) {
            errors.add("Not an embed URL with ?vt=… (expected https://embed.wolvy.stream/{video}/{base64 account}?vt=…)")
            render(); return
        }
        diag["video"] = parsed.videoId
        diag["account"] = parsed.accountId
        diag["endpoint"] = "calling app_render_video…"
        render()
        Thread {
            val answer = try { fetchPlayback(parsed) } catch (e: Exception) { Result.failure(e) }
            main.post { if (!released) onPlayback(parsed, answer) }
        }.start()
    }

    fun release() {
        released = true
        releasePlayer()
    }

    // ---- playback data ---------------------------------------------------------------------

    private data class Embed(val videoId: String, val accountId: String, val vt: String)

    private fun parseEmbed(url: String): Embed? {
        val uri = Uri.parse(url.trim())
        val segs = uri.pathSegments ?: return null
        val vt = uri.getQueryParameter("vt") ?: return null
        if (segs.size < 2) return null
        val account = try {
            String(Base64.decode(segs[1], Base64.DEFAULT or Base64.URL_SAFE), Charsets.UTF_8).trim()
        } catch (e: Exception) { return null }
        if (!account.all { it.isDigit() } || account.isEmpty()) return null
        return Embed(segs[0], account, vt)
    }

    private fun fetchPlayback(e: Embed): Result<JSONObject> {
        val conn = URL("$API/app_render_video").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 15000
        conn.readTimeout = 20000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
        conn.setRequestProperty("X-Wolvy-Platform", "android")
        conn.setRequestProperty("X-Wolvy-App-Id", context.packageName)
        conn.setRequestProperty("X-Wolvy-SDK", SDK_HEADER)
        fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
        val body = "user_id=${enc(e.accountId)}&video_id=${enc(e.videoId)}&vt=${enc(e.vt)}"
        conn.outputStream.use { it.write(body.toByteArray()) }
        val code = conn.responseCode
        val text = (if (code < 400) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        val json = try { JSONObject(text) } catch (x: Exception) {
            return Result.failure(RuntimeException("HTTP $code, not JSON: ${text.take(120)}"))
        }
        if (json.optString("status") != "success") {
            return Result.failure(RuntimeException("HTTP $code ${json.optString("code")}: ${json.optString("message")}"))
        }
        return Result.success(json)
    }

    private fun onPlayback(e: Embed, answer: Result<JSONObject>) {
        val data = answer.getOrElse {
            diag["endpoint"] = "refused"
            errors.add("app_render_video: ${it.message}")
            render(); return
        }
        diag["endpoint"] = "OK"
        diag["platform"] = data.optString("platform")
        diag["app_only_l3"] = data.optBoolean("app_only_l3").toString()
        val server = data.optString("server_id")
        val cdnToken = data.optString("cdn_token")
        val cdnExp = data.opt("cdn_exp")?.toString() ?: ""
        val session = data.optString("session_id")
        val licence = data.optString("token")
        val host = "$server.wolvy-cdn.net"
        diag["cdn host"] = host + if (session.isEmpty()) " (no session id!)" else " (session id sent)"
        val manifest = "https://$host/${e.accountId}/${e.videoId}/dash/manifest.mpd" +
            if (cdnToken.isNotEmpty()) "?token=${URLEncoder.encode(cdnToken, "UTF-8")}&exp=$cdnExp" else ""
        val headers = HashMap<String, String>()
        if (cdnToken.isNotEmpty()) { headers["X-CDN-Token"] = cdnToken; headers["X-CDN-Exp"] = cdnExp }
        if (session.isNotEmpty()) headers["X-CDN-Session"] = session
        play(manifest, headers, "$API/process_videos/widevine?token=${URLEncoder.encode(licence, "UTF-8")}")
    }

    // ---- player ---------------------------------------------------------------------------

    private fun play(manifest: String, headers: Map<String, String>, licenceUrl: String) {
        val media = DefaultHttpDataSource.Factory()
            .setUserAgent("$SDK_HEADER (${context.packageName})")
            .setDefaultRequestProperties(headers)
        val drmHttp = DefaultHttpDataSource.Factory().setUserAgent("$SDK_HEADER (${context.packageName})")
        val drmProvider = DefaultDrmSessionManagerProvider().apply { setDrmHttpDataSourceFactory(drmHttp) }
        val selector = DefaultTrackSelector(context)
        trackSelector = selector
        val exo = ExoPlayer.Builder(context)
            .setTrackSelector(selector)
            .setMediaSourceFactory(DefaultMediaSourceFactory(media).setDrmSessionManagerProvider(drmProvider))
            .build()
        player = exo
        applyCap()
        exo.addAnalyticsListener(analytics)
        exo.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                errors.add("${error.errorCodeName}: ${error.message}${error.cause?.let { " / ${it.javaClass.simpleName}: ${it.message}" } ?: ""}")
                render()
            }
        })
        playerView.player = exo
        val item = MediaItem.Builder()
            .setUri(manifest)
            .setMimeType(MimeTypes.APPLICATION_MPD)
            .setDrmConfiguration(MediaItem.DrmConfiguration.Builder(C.WIDEVINE_UUID).setLicenseUri(licenceUrl).build())
            .build()
        exo.setMediaItem(item)
        exo.prepare()
        exo.playWhenReady = true
        tick()
    }

    private fun applyCap() {
        val sel = trackSelector ?: return
        val p = sel.buildUponParameters()
        if (cap480) p.setMaxVideoSize(Int.MAX_VALUE, SD_MAX_HEIGHT).setForceHighestSupportedBitrate(false)
        else p.clearVideoSizeConstraints().setForceHighestSupportedBitrate(true) // ask for the top rendition at once
        sel.setParameters(p)
        diag["quality asked"] = if (cap480) "capped at 480p" else "highest rendition (HD test)"
    }

    private val analytics = object : AnalyticsListener {
        override fun onVideoDecoderInitialized(t: AnalyticsListener.EventTime, decoderName: String, initializedTimestampMs: Long, initializationDurationMs: Long) {
            diag["decoder"] = decoderName + if (decoderName.endsWith(".secure")) "  (secure: hardware DRM path)" else "  (not secure)"
            render()
        }
        override fun onVideoInputFormatChanged(t: AnalyticsListener.EventTime, format: Format, eval: DecoderReuseEvaluation?) {
            diag["video format"] = "${format.width}x${format.height}, ${format.codecs ?: format.sampleMimeType}, ${format.bitrate / 1000} kbit/s"
            render()
        }
        override fun onRenderedFirstFrame(t: AnalyticsListener.EventTime, output: Any, renderTimeMs: Long) {
            diag["first frame"] = "drawn to ${output.javaClass.simpleName}"
            render()
        }
        override fun onDroppedVideoFrames(t: AnalyticsListener.EventTime, droppedFrames: Int, elapsedMs: Long) {
            diag["dropped"] = ((diag["dropped"]?.toIntOrNull() ?: 0) + droppedFrames).toString()
        }
        override fun onDrmKeysLoaded(t: AnalyticsListener.EventTime) { diag["drm"] = "licence received, keys loaded"; render() }
        override fun onDrmSessionManagerError(t: AnalyticsListener.EventTime, error: Exception) {
            errors.add("DRM: ${error.javaClass.simpleName}: ${error.message}"); render()
        }
    }

    private fun tick() {
        val exo = player ?: return
        exo.videoDecoderCounters?.let { diag["frames drawn"] = it.renderedOutputBufferCount.toString() }
        diag["position"] = "${exo.currentPosition / 1000}s / ${if (exo.duration > 0) exo.duration / 1000 else 0}s, state ${stateName(exo.playbackState)}"
        render()
        main.postDelayed({ tick() }, 1000)
    }

    private fun releasePlayer() {
        main.removeCallbacksAndMessages(null)
        playerView.player = null
        player?.release()
        player = null
        trackSelector = null
    }

    // ---- device ---------------------------------------------------------------------------

    private fun readWidevine() {
        try {
            val drm = MediaDrm(UUID.fromString("edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"))
            fun prop(n: String) = try { drm.getPropertyString(n) } catch (e: Exception) { "?" }
            diag["widevine"] = "level ${prop("securityLevel")}, HDCP ${prop("hdcpLevel")} (max ${prop("maxHdcpLevel")}), version ${prop("version")}"
            if (Build.VERSION.SDK_INT >= 28) drm.close() else @Suppress("DEPRECATION") drm.release()
        } catch (e: Exception) {
            diag["widevine"] = "not available: ${e.message}"
        }
    }

    // ---- report ---------------------------------------------------------------------------

    private fun report(): String = buildString {
        append("Wolvy SDK spike report (phase 3 step 1)\n")
        diag.forEach { (k, v) -> append(k).append(": ").append(v).append('\n') }
        append("seen by eye: ").append(seenByEye).append('\n')
        append("errors: ").append(if (errors.isEmpty()) "none" else errors.joinToString(" | ")).append('\n')
    }

    private fun render() { info.text = report() }

    private fun copyReport() {
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("Wolvy spike report", report()))
        Toast.makeText(context, "Report copied (no tokens in it)", Toast.LENGTH_SHORT).show()
    }

    private fun stateName(s: Int) = when (s) {
        Player.STATE_IDLE -> "idle"; Player.STATE_BUFFERING -> "buffering"
        Player.STATE_READY -> "ready"; Player.STATE_ENDED -> "ended"; else -> s.toString()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // No release on detach: Flutter and React Native may detach and re-attach a native view.
    // The host calls release() (PlatformView.dispose, onDropViewInstance, onDestroy).
}
