import { SupportEmailLink } from '../ui/SupportEmailLink'

export function AuthErrorAlert({ message }: { message: string }) {
  return (
    <div className="space-y-2" role="alert">
      <p className="font-body text-sm text-tier-deadline">{message}</p>
      <p className="font-body text-xs text-stone">
        Need help? Contact <SupportEmailLink />
      </p>
    </div>
  )
}
