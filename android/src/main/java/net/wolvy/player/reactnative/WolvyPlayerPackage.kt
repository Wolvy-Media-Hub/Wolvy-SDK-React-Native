package net.wolvy.player.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class WolvyPlayerPackage : BaseReactPackage() {
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(WolvyPlayerViewManager())

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == WolvyPlayerModule.NAME) WolvyPlayerModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            WolvyPlayerModule.NAME to ReactModuleInfo(
                WolvyPlayerModule.NAME, WolvyPlayerModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true,  // isTurboModule
            ),
        )
    }
}
