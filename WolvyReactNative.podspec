require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# The iOS side of @wolvy/react-native: a Fabric view and a TurboModule (Objective-C++) over the
# Wolvy iOS SDK, whose Swift sources are carried in ios/WolvyCore (scripts/sync-ios-core.sh,
# commit in ios/CORE_VERSION) because CocoaPods trunk takes no new pods.
Pod::Spec.new do |s|
  s.name         = "WolvyReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://docs.wolvy.net/mobile-sdks/"
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/Wolvy-Media-Hub/Wolvy-SDK-React-Native.git", :tag => "v#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  # The Objective-C++ glue stays out of the module Swift sees (its headers lead to C++).
  s.private_header_files = "ios/**/*.h"
  s.frameworks   = "AVFoundation", "UIKit"
  s.swift_version = "5.9"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  install_modules_dependencies(s)
end
