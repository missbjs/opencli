import Foundation

public enum OpenCLICameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum OpenCLICameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum OpenCLICameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum OpenCLICameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct OpenCLICameraSnapParams: Codable, Sendable, Equatable {
    public var facing: OpenCLICameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: OpenCLICameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: OpenCLICameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: OpenCLICameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct OpenCLICameraClipParams: Codable, Sendable, Equatable {
    public var facing: OpenCLICameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: OpenCLICameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: OpenCLICameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: OpenCLICameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
