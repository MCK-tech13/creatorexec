export interface UserEngagementState {
  lastCsvUploadAt: string | null
  lastUploadReminderSentAt: string | null
  uploadReminderDismissedAt: string | null
}

export function emptyUserEngagement(): UserEngagementState {
  return {
    lastCsvUploadAt: null,
    lastUploadReminderSentAt: null,
    uploadReminderDismissedAt: null,
  }
}
