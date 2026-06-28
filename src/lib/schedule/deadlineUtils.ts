export function getDaysUntilDeadline(deadlineDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(`${deadlineDate}T00:00:00`)
  deadline.setHours(0, 0, 0, 0)
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000)
}

export function formatDeadlineCountdown(deadlineDate: string): string {
  const days = getDaysUntilDeadline(deadlineDate)
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}
