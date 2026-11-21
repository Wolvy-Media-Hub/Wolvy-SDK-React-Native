import Foundation
import UIKit

/// One <WolvyPlayer>: a WolvyPlayer and WolvyPlayerView from the Wolvy iOS SDK (in WolvyCore).
/// No playback logic here: the module's commands go to the core; events and token requests go to
/// JavaScript, with the same names and data as on Android. The Fabric view (WolvyPlayerComponentView.mm)
/// shows it and the TurboModule (WolvyPlayerModule.mm) finds it by its React tag.
@objc(WolvyRNPlayer)
@MainActor
public final class WolvyRNPlayer: UIView, WolvyPlayerListener {
    /// This package's version, sent to Wolvy in X-Wolvy-SDK.
    static let version = "0.2.0"

    private static let registry = NSMapTable<NSNumber, WolvyRNPlayer>.strongToWeakObjects()

    /// The player of the view with this React tag, while it is mounted.
    @objc public static func find(_ tag: Int) -> WolvyRNPlayer? { registry.object(forKey: NSNumber(value: tag)) }

    /// Set by the Fabric view: registers this player under its tag.
    @objc public var reactTag: Int = 0 {
        didSet {
            if oldValue != 0, Self.registry.object(forKey: NSNumber(value: oldValue)) === self {
                Self.registry.removeObject(forKey: NSNumber(value: oldValue))
            }
            if reactTag != 0 { Self.registry.setObject(self, forKey: NSNumber(value: reactTag)) }
        }
    }

    /// Every player event: its web name and its data as JSON.
    @objc public var onEvent: ((String, String) -> Void)?
    /// The player needs a fresh viewer token: the request id and the video id.
    @objc public var onTokenRequest: ((Int, String) -> Void)?

    @objc public var showControls: Bool {
        get { playerView.showControls }
        set { playerView.showControls = newValue }
    }

    let player = WolvyPlayer(source: WolvyAppRenderVideoSource(
        sdk: "wolvy-react-native/\(WolvyRNPlayer.version)+ios.\(WolvyPlayer.sdkVersion)"))
    private let playerView = WolvyPlayerView()
    private var released = false
    private var nextRequest = 1
    private var pending: [Int: CheckedContinuation<String?, Error>] = [:]

    public override init(frame: CGRect) {
        super.init(frame: frame)
        playerView.frame = bounds
        playerView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(playerView)
        playerView.player = player
        player.addListener(self)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    /// The view was removed: stop and free the player, and fail any token request still waiting.
    @objc public func releasePlayer() {
        guard !released else { return }
        released = true
        reactTag = 0
        for continuation in pending.values {
            continuation.resume(throwing: TokenError(errorDescription: "The view was removed."))
        }
        pending.removeAll()
        playerView.player = nil
        player.release()
    }

    // MARK: - Commands (from the TurboModule)

    /// Runs one command of the web Player API. `resolve` gets nil, a number or a JSON string;
    /// `reject` gets the web error code, the message and the reason.
    @objc public func run(_ command: String, args: [String: Any],
                          resolve: @escaping (Any?) -> Void,
                          reject: @escaping (String, String, String?) -> Void) {
        do {
            switch command {
            case "load":
                let video = try WolvyVideo(
                    videoId: args["videoId"] as? String ?? "",
                    accountId: Int64((args["accountId"] as? NSNumber)?.doubleValue ?? 0),
                    viewerToken: args["viewerToken"] as? String ?? "",
                    tokenProvider: (args["hasTokenProvider"] as? Bool ?? false) ? tokenProvider() : nil)
                try player.load(video, autoplay: args["autoplay"] as? Bool ?? true)
                resolve(nil)
            case "play": try player.play(); resolve(nil)
            case "pause": try player.pause(); resolve(nil)
            case "seek": resolve(try player.seek((args["seconds"] as? NSNumber)?.doubleValue ?? 0))
            case "mute": try player.mute(); resolve(nil)
            case "unmute": try player.unmute(); resolve(nil)
            case "setVolume": try player.setVolume((args["volume"] as? NSNumber)?.floatValue ?? -1); resolve(nil)
            case "setPlaybackRate": try player.setPlaybackRate((args["rate"] as? NSNumber)?.floatValue ?? -1); resolve(nil)
            case "setQuality":
                let height = (args["height"] as? NSNumber)?.intValue ?? -1
                try player.setQuality(height < 0 ? nil : height)
                resolve(nil)
            case "setCaptions":
                let language = args["language"] as? String ?? ""
                try player.setCaptions(language.isEmpty ? nil : language)
                resolve(nil)
            case "retry": try player.retry(); resolve(nil)
            case "getState": resolve(Self.json(Self.map(player.getState())))
            case "getQualities": resolve(Self.json(Self.map(player.getQualities())))
            case "getCaptions":
                let c = player.getCaptions()
                resolve(Self.json(["available": c.available.map { ["language": $0.language, "label": $0.label] },
                                   "active": Self.null(c.active)]))
            case "getProgress": resolve(Self.json(Self.map(player.getProgress())))
            case "getVideoInfo": resolve(player.videoInfo.map { Self.json(Self.map($0)) } ?? "null")
            default:
                reject(WolvyError.Code.failed.rawValue, "Unknown command \(command).", nil)
            }
        } catch let error as WolvyError {
            reject(error.code.rawValue, error.message, error.reason)
        } catch {
            reject(WolvyError.Code.failed.rawValue, error.localizedDescription, nil)
        }
    }

    /// The module's answer to a token request: a token, or an error message.
    @objc public func resolveToken(_ requestId: Int, token: String, error: String) {
        guard let continuation = pending.removeValue(forKey: requestId) else { return }
        if !error.isEmpty {
            continuation.resume(throwing: TokenError(errorDescription: "The app's token provider failed: \(error)"))
        } else {
            continuation.resume(returning: token.isEmpty ? nil : token)
        }
    }

    // MARK: - Short tokens: asks JavaScript (30 s at most)

    private struct TokenError: LocalizedError {
        let errorDescription: String?
    }

    private func tokenProvider() -> WolvyViewerTokenProvider {
        { [weak self] video in
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String?, Error>) in
                Task { @MainActor in
                    guard let self, !self.released else {
                        continuation.resume(throwing: TokenError(errorDescription: "The view was removed."))
                        return
                    }
                    let id = self.nextRequest
                    self.nextRequest += 1
                    self.pending[id] = continuation
                    DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
                        MainActor.assumeIsolated {
                            self?.pending.removeValue(forKey: id)?
                                .resume(throwing: TokenError(errorDescription: "The app's token provider did not answer in 30 s."))
                        }
                    }
                    self.onTokenRequest?(id, video.videoId)
                }
            }
        }
    }

    // MARK: - Events

    private func send(_ name: String, _ data: [String: Any]) {
        guard !released else { return }
        onEvent?(name, Self.json(data))
    }

    public func onReady(_ state: WolvyState) { send("ready", Self.map(state)) }
    public func onPlay(_ currentTime: Double) { send("play", ["currentTime": currentTime]) }
    public func onPause(_ currentTime: Double) { send("pause", ["currentTime": currentTime]) }
    public func onEnded() { send("ended", [:]) }
    public func onSeeked(_ currentTime: Double) { send("seeked", ["currentTime": currentTime]) }
    public func onTimeUpdate(_ currentTime: Double, duration: Double) { send("timeupdate", ["currentTime": currentTime, "duration": duration]) }
    public func onProgress(_ progress: WolvyProgress) { send("progress", Self.map(progress)) }
    public func onVolumeChange(_ volume: Float, muted: Bool) { send("volumechange", ["volume": Double(volume), "muted": muted]) }
    public func onRateChange(_ playbackRate: Float) { send("ratechange", ["playbackRate": Double(playbackRate)]) }
    public func onQualityChange(_ qualities: WolvyQualities) { send("qualitychange", Self.map(qualities)) }
    public func onCaptionsChange(_ active: String?) { send("captionschange", ["active": Self.null(active)]) }
    public func onFullscreenChange(_ fullscreen: Bool) { send("fullscreenchange", ["fullscreen": fullscreen]) }
    public func onError(_ error: WolvyError) {
        send("error", ["code": error.code.rawValue, "message": error.message, "reason": Self.null(error.reason)])
    }
    public func onCaptionCue(_ text: String?) { send("captioncue", ["text": Self.null(text)]) }

    // MARK: - JSON (nil is null)

    static func null(_ value: Any?) -> Any { value ?? NSNull() }

    static func json(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed]) else { return "null" }
        return String(decoding: data, as: UTF8.self)
    }

    static func map(_ s: WolvyState) -> [String: Any] {
        ["currentTime": s.currentTime, "duration": s.duration, "paused": s.paused,
         "muted": s.muted, "volume": Double(s.volume), "playbackRate": Double(s.playbackRate)]
    }

    static func map(_ q: WolvyQualities) -> [String: Any] {
        ["available": q.available, "selected": null(q.selected), "playing": null(q.playing)]
    }

    static func map(_ p: WolvyProgress) -> [String: Any] {
        ["percent": p.percent, "seconds": p.seconds, "duration": p.duration]
    }

    static func map(_ i: WolvyVideoInfo) -> [String: Any] {
        [
            "chapters": i.chapters.map { ["start": $0.start, "end": $0.end, "title": $0.title] },
            "moments": i.moments.map { ["timestamp": $0.timestamp, "label": $0.label] },
            "viewerId": null(i.viewerId),
            // JavaScript reads the colour as 0xAARRGGBB, as Android sends it.
            "playerColor": null(i.playerColor.flatMap(argb)),
            "poster": null(i.poster?.absoluteString),
        ]
    }

    /// "#RRGGBB" as 0xFFRRGGBB.
    static func argb(_ hex: String) -> Int? {
        guard hex.count == 7, hex.hasPrefix("#"), let rgb = Int(hex.dropFirst(), radix: 16) else { return nil }
        return 0xFF00_0000 | rgb
    }
}
