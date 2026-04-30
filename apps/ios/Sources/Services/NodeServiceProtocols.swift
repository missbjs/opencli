import CoreLocation
import Foundation
import OpenCLIKit
import UIKit

typealias OpenCLICameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias OpenCLICameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: OpenCLICameraSnapParams) async throws -> OpenCLICameraSnapResult
    func clip(params: OpenCLICameraClipParams) async throws -> OpenCLICameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: OpenCLILocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: OpenCLILocationGetParams,
        desiredAccuracy: OpenCLILocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: OpenCLILocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> OpenCLIDeviceStatusPayload
    func info() -> OpenCLIDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: OpenCLIPhotosLatestParams) async throws -> OpenCLIPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: OpenCLIContactsSearchParams) async throws -> OpenCLIContactsSearchPayload
    func add(params: OpenCLIContactsAddParams) async throws -> OpenCLIContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: OpenCLICalendarEventsParams) async throws -> OpenCLICalendarEventsPayload
    func add(params: OpenCLICalendarAddParams) async throws -> OpenCLICalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: OpenCLIRemindersListParams) async throws -> OpenCLIRemindersListPayload
    func add(params: OpenCLIRemindersAddParams) async throws -> OpenCLIRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: OpenCLIMotionActivityParams) async throws -> OpenCLIMotionActivityPayload
    func pedometer(params: OpenCLIPedometerParams) async throws -> OpenCLIPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: OpenCLIWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: OpenCLIWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: OpenCLIWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: OpenCLIWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: OpenCLIWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: OpenCLIWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
