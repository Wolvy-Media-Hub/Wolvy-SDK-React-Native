package net.wolvy.player.reactnative

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.WolvyPlayerViewManagerDelegate
import com.facebook.react.viewmanagers.WolvyPlayerViewManagerInterface

@ReactModule(name = WolvyPlayerViewManager.NAME)
class WolvyPlayerViewManager : SimpleViewManager<WolvyRNView>(), WolvyPlayerViewManagerInterface<WolvyRNView> {
    private val delegate: ViewManagerDelegate<WolvyRNView> = WolvyPlayerViewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<WolvyRNView> = delegate

    override fun getName(): String = NAME

    override fun createViewInstance(context: ThemedReactContext): WolvyRNView = WolvyRNView(context)

    @ReactProp(name = "showControls", defaultBoolean = true)
    override fun setShowControls(view: WolvyRNView, value: Boolean) {
        view.showControls = value
    }

    override fun onDropViewInstance(view: WolvyRNView) {
        view.release()
        super.onDropViewInstance(view)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
        "topWolvyEvent" to mapOf("registrationName" to "onWolvyEvent"),
        "topTokenRequest" to mapOf("registrationName" to "onTokenRequest"),
    )

    companion object {
        const val NAME = "WolvyPlayerView"
    }
}
