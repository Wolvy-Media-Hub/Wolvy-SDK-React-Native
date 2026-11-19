package net.wolvy.spike.reactnative

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import net.wolvy.spike.player.SpikePlayerView

/**
 * <WolvySpikeView embedUrl="…" /> in JavaScript. A legacy view manager, used by the new
 * architecture through its interop layer: the SpikePlayerView is a real Android view in the
 * window, which is what hardware-protected video needs.
 */
class SpikeViewManager : SimpleViewManager<SpikePlayerView>() {
    private val lastUrl = HashMap<Int, String>()

    override fun getName() = "WolvySpikeView"

    override fun createViewInstance(context: ThemedReactContext) =
        SpikePlayerView(context, "react-native 0.85.3 (new architecture, view manager interop)")

    @ReactProp(name = "embedUrl")
    fun setEmbedUrl(view: SpikePlayerView, url: String?) {
        if (url.isNullOrBlank() || lastUrl[view.id] == url) return
        lastUrl[view.id] = url
        view.start(url)
    }

    override fun onDropViewInstance(view: SpikePlayerView) {
        lastUrl.remove(view.id)
        view.release()
        super.onDropViewInstance(view)
    }
}
