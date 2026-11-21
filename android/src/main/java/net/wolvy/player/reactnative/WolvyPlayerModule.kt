package net.wolvy.player.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.UIManagerHelper
import net.wolvy.player.WolvyError
import net.wolvy.player.WolvyPlayer
import net.wolvy.player.WolvyVideo
import org.json.JSONArray
import org.json.JSONObject

/** The commands of a <WolvyPlayer>, by view tag, run on the main thread like the core requires. */
@ReactModule(name = WolvyPlayerModule.NAME)
class WolvyPlayerModule(context: ReactApplicationContext) : NativeWolvyPlayerModuleSpec(context) {

    override fun getName(): String = NAME

    private fun view(tag: Double): WolvyRNView? =
        UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, tag.toInt())?.resolveView(tag.toInt()) as? WolvyRNView

    private fun run(tag: Double, promise: Promise, action: (WolvyRNView, WolvyPlayer) -> Any?) {
        UiThreadUtil.runOnUiThread {
            val v = try { view(tag) } catch (e: Exception) { null }
            if (v == null) {
                promise.reject(WolvyError.Code.DESTROYED.value, "The player view is not mounted.")
                return@runOnUiThread
            }
            try {
                promise.resolve(action(v, v.player))
            } catch (e: WolvyError) {
                promise.reject(e.code.value, e.message, com.facebook.react.bridge.Arguments.createMap().apply { putString("reason", e.reason) })
            } catch (e: IllegalArgumentException) {
                promise.reject(WolvyError.Code.INVALID_ARGUMENT.value, e.message)
            }
        }
    }

    override fun load(viewTag: Double, videoId: String, accountId: Double, viewerToken: String, hasTokenProvider: Boolean, autoplay: Boolean, promise: Promise) =
        run(viewTag, promise) { v, p ->
            p.load(WolvyVideo(videoId, accountId.toLong(), viewerToken, if (hasTokenProvider) v.tokenProvider else null), autoplay); null
        }

    override fun play(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.play(); null }
    override fun pause(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.pause(); null }
    override fun seek(viewTag: Double, seconds: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.seek(seconds) }
    override fun mute(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.mute(); null }
    override fun unmute(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.unmute(); null }
    override fun setVolume(viewTag: Double, volume: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.setVolume(volume.toFloat()); null }
    override fun setPlaybackRate(viewTag: Double, rate: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.setPlaybackRate(rate.toFloat()); null }
    override fun setQuality(viewTag: Double, height: Double, promise: Promise) =
        run(viewTag, promise) { _, p -> p.setQuality(if (height < 0) null else height.toInt()); null }
    override fun setCaptions(viewTag: Double, language: String, promise: Promise) =
        run(viewTag, promise) { _, p -> p.setCaptions(language.ifEmpty { null }); null }
    override fun retry(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.retry(); null }

    override fun getState(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.getState().json().toString() }
    override fun getQualities(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.getQualities().json().toString() }
    override fun getProgress(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p -> p.getProgress().json().toString() }
    override fun getCaptions(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p ->
        val c = p.getCaptions()
        JSONObject()
            .put("available", JSONArray(c.available.map { JSONObject().put("language", it.language).put("label", it.label) }))
            .put("active", c.active ?: JSONObject.NULL).toString()
    }
    override fun getVideoInfo(viewTag: Double, promise: Promise) = run(viewTag, promise) { _, p ->
        val i = p.videoInfo ?: return@run "null"
        JSONObject()
            .put("chapters", JSONArray(i.chapters.map { JSONObject().put("start", it.start).put("end", it.end).put("title", it.title) }))
            .put("moments", JSONArray(i.moments.map { JSONObject().put("timestamp", it.timestamp).put("label", it.label) }))
            .put("viewerId", i.viewerId ?: JSONObject.NULL)
            .put("playerColor", i.playerColor ?: JSONObject.NULL)
            .put("poster", i.poster ?: JSONObject.NULL).toString()
    }

    override fun resolveViewerToken(viewTag: Double, requestId: Double, token: String, error: String) {
        UiThreadUtil.runOnUiThread { view(viewTag)?.resolveToken(requestId.toInt(), token, error) }
    }

    companion object {
        const val NAME = "WolvyPlayerModule"
    }
}
