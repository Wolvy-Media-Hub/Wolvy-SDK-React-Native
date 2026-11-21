package net.wolvy.player.reactnative

import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import net.wolvy.player.AppRenderVideoSource
import net.wolvy.player.BuildConfig as CoreBuildConfig
import net.wolvy.player.Progress
import net.wolvy.player.Qualities
import net.wolvy.player.State
import net.wolvy.player.ViewerTokenProvider
import net.wolvy.player.WolvyError
import net.wolvy.player.WolvyPlayer
import net.wolvy.player.WolvyPlayerListener
import net.wolvy.player.WolvyPlayerView
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * One <WolvyPlayer>: a WolvyPlayer and WolvyPlayerView from the Wolvy Android SDK. No playback
 * logic here: the module's commands go to the core; events and token requests go to JavaScript.
 */
class WolvyRNView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
    private val main = Handler(Looper.getMainLooper())
    val player = WolvyPlayer(
        reactContext,
        // Built from the context, so the app proves itself (app protection) when the account set it up.
        AppRenderVideoSource(reactContext, "wolvy-react-native/$VERSION+android.${CoreBuildConfig.SDK_VERSION}"),
    )
    // The activity, when known: the view sets FLAG_SECURE on its window.
    private val playerView = WolvyPlayerView(reactContext.currentActivity ?: reactContext).also { it.player = player }
    @Volatile private var released = false

    private val nextRequest = AtomicInteger(1)
    private val pending = ConcurrentHashMap<Int, Pair<CountDownLatch, Array<Any?>>>()

    /** Asks JavaScript for a fresh viewer token; runs on the player's background thread. */
    val tokenProvider = ViewerTokenProvider { video ->
        val id = nextRequest.getAndIncrement()
        val latch = CountDownLatch(1)
        val slot = arrayOfNulls<Any?>(2) // [token, error]
        pending[id] = latch to slot
        main.post {
            dispatch("topTokenRequest", Arguments.createMap().apply {
                putInt("requestId", id)
                putString("videoId", video.videoId)
            })
        }
        try {
            if (!latch.await(30, TimeUnit.SECONDS)) throw IOException("The app's token provider did not answer in 30 s.")
        } finally {
            pending.remove(id)
        }
        (slot[1] as String?)?.takeIf { it.isNotEmpty() }?.let { throw IOException("The app's token provider failed: $it") }
        (slot[0] as String?)?.takeIf { it.isNotEmpty() }
    }

    /** The module's answer to a token request. */
    fun resolveToken(requestId: Int, token: String, error: String) {
        val (latch, slot) = pending[requestId] ?: return
        slot[0] = token
        slot[1] = error
        latch.countDown()
    }

    private val events = object : WolvyPlayerListener {
        override fun onReady(state: State) = send("ready", state.json())
        override fun onPlay(currentTime: Double) = send("play", JSONObject().put("currentTime", currentTime))
        override fun onPause(currentTime: Double) = send("pause", JSONObject().put("currentTime", currentTime))
        override fun onEnded() = send("ended", JSONObject())
        override fun onSeeked(currentTime: Double) = send("seeked", JSONObject().put("currentTime", currentTime))
        override fun onTimeUpdate(currentTime: Double, duration: Double) =
            send("timeupdate", JSONObject().put("currentTime", currentTime).put("duration", duration))
        override fun onProgress(progress: Progress) = send("progress", progress.json())
        override fun onVolumeChange(volume: Float, muted: Boolean) =
            send("volumechange", JSONObject().put("volume", volume.toDouble()).put("muted", muted))
        override fun onRateChange(playbackRate: Float) = send("ratechange", JSONObject().put("playbackRate", playbackRate.toDouble()))
        override fun onQualityChange(qualities: Qualities) = send("qualitychange", qualities.json())
        override fun onCaptionsChange(active: String?) = send("captionschange", JSONObject().put("active", active ?: JSONObject.NULL))
        override fun onFullscreenChange(fullscreen: Boolean) = send("fullscreenchange", JSONObject().put("fullscreen", fullscreen))
        override fun onError(error: WolvyError) = send("error", JSONObject()
            .put("code", error.code.value).put("message", error.message ?: "").put("reason", error.reason ?: JSONObject.NULL))
        override fun onCaptionCue(text: String?) = send("captioncue", JSONObject().put("text", text ?: JSONObject.NULL))
    }

    init {
        addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        player.addListener(events)
    }

    var showControls: Boolean
        get() = playerView.showControls
        set(value) { playerView.showControls = value }

    fun release() {
        if (released) return
        released = true
        pending.values.forEach { (latch, slot) -> slot[1] = "The view was removed."; latch.countDown() }
        playerView.player = null
        player.release()
    }

    // React Native lays out its own views; the native player inside must be measured by hand when
    // it asks for a layout (controls appearing, the watermark moving). Also called from the
    // constructor of FrameLayout, before this class's fields exist: no field is used here.
    override fun requestLayout() {
        super.requestLayout()
        post { measureAndLayout() }
    }

    private fun measureAndLayout() {
        measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
        layout(left, top, right, bottom)
    }

    private fun send(name: String, data: JSONObject) {
        if (released) return
        dispatch("topWolvyEvent", Arguments.createMap().apply {
            putString("name", name)
            putString("data", data.toString())
        })
    }

    private fun dispatch(eventName: String, payload: WritableMap) {
        val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id) ?: return
        dispatcher.dispatchEvent(WolvyRNEvent(UIManagerHelper.getSurfaceId(reactContext), id, eventName, payload))
    }

    companion object {
        const val VERSION = "0.3.0"
    }
}

internal class WolvyRNEvent(surfaceId: Int, viewTag: Int, private val name: String, private val payload: WritableMap) :
    Event<WolvyRNEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
}

internal fun State.json(): JSONObject = JSONObject()
    .put("currentTime", currentTime).put("duration", duration).put("paused", paused)
    .put("muted", muted).put("volume", volume.toDouble()).put("playbackRate", playbackRate.toDouble())
    .put("attested", attested)

internal fun Qualities.json(): JSONObject = JSONObject()
    .put("available", JSONArray(available)).put("selected", selected ?: JSONObject.NULL).put("playing", playing ?: JSONObject.NULL)

internal fun Progress.json(): JSONObject = JSONObject()
    .put("percent", percent).put("seconds", seconds).put("duration", duration)
