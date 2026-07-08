export const CONTENT_POLICY_DISCLAIMER_TEXT =
  "Always follow TikTok Shop's current content policies. Prioritize high-quality, high-value content over repetition or low-effort posting."

interface ContentPolicyDisclaimerProps {
  className?: string
}

/** Condensed content-policy reminder — full terms live in the Terms of Service. */
export function ContentPolicyDisclaimer({ className = '' }: ContentPolicyDisclaimerProps) {
  return (
    <p
      className={`font-body text-xs leading-relaxed text-stone ${className}`.trim()}
      role="note"
    >
      {CONTENT_POLICY_DISCLAIMER_TEXT}
    </p>
  )
}
