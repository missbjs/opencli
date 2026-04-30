import Foundation

public enum OpenCLIRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum OpenCLIReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct OpenCLIRemindersListParams: Codable, Sendable, Equatable {
    public var status: OpenCLIReminderStatusFilter?
    public var limit: Int?

    public init(status: OpenCLIReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct OpenCLIRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct OpenCLIReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct OpenCLIRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [OpenCLIReminderPayload]

    public init(reminders: [OpenCLIReminderPayload]) {
        self.reminders = reminders
    }
}

public struct OpenCLIRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: OpenCLIReminderPayload

    public init(reminder: OpenCLIReminderPayload) {
        self.reminder = reminder
    }
}
