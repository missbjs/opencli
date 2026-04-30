import Foundation

public enum OpenCLIDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum OpenCLIBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum OpenCLIThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum OpenCLINetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum OpenCLINetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct OpenCLIBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: OpenCLIBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: OpenCLIBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct OpenCLIThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: OpenCLIThermalState

    public init(state: OpenCLIThermalState) {
        self.state = state
    }
}

public struct OpenCLIStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct OpenCLINetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: OpenCLINetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [OpenCLINetworkInterfaceType]

    public init(
        status: OpenCLINetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [OpenCLINetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct OpenCLIDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: OpenCLIBatteryStatusPayload
    public var thermal: OpenCLIThermalStatusPayload
    public var storage: OpenCLIStorageStatusPayload
    public var network: OpenCLINetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: OpenCLIBatteryStatusPayload,
        thermal: OpenCLIThermalStatusPayload,
        storage: OpenCLIStorageStatusPayload,
        network: OpenCLINetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct OpenCLIDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
