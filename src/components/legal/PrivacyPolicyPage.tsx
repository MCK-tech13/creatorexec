import { SupportEmailLink } from '../ui/SupportEmailLink'
import {
  LegalDocumentLayout,
  LegalList,
  LegalParagraph,
  LegalSection,
} from './LegalDocumentLayout'

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="CreatorExec Privacy Policy" lastUpdated="July 7, 2026">
      <LegalParagraph>
        CreatorExec (&quot;we,&quot; &quot;our,&quot; or &quot;the app&quot;) is operated by MCK Creative
        Group LLC. This policy explains what information we collect, how we use it, and how we
        protect it.
      </LegalParagraph>

      <LegalSection title="Information We Collect">
        <LegalParagraph>
          <strong className="font-medium text-ink">Account information:</strong> When you create an
          account, we collect your email address and any profile information you provide.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="font-medium text-ink">Sales and product data:</strong> When you upload
          commission reports (CSV/XLSX files) from TikTok Shop, we process this data to power
          features like product tier ranking, sprint scheduling, and income tracking. This data is
          stored securely and associated with your account.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="font-medium text-ink">Usage data:</strong> We may collect basic usage
          information (e.g., features used, general activity) to improve the app.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="How We Use Your Information">
        <LegalParagraph>We use collected information to:</LegalParagraph>
        <LegalList
          items={[
            'Provide and improve CreatorExec\'s features',
            'Generate personalized sprint schedules and product tier rankings',
            'Detect potential brand deal opportunities (only if you\'ve connected Gmail)',
            'Communicate with you about your account or the service',
          ]}
        />
      </LegalSection>

      <LegalSection title="Data Storage and Security">
        <LegalParagraph>
          Your data is stored securely using industry-standard practices. We do not sell your
          personal information or data to third parties.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Third-Party Services">
        <LegalParagraph>
          CreatorExec may use third-party services (such as Google APIs for Gmail integration, and
          payment processors for subscriptions) to operate the app. These services have their own
          privacy policies governing their handling of data.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Your Choices">
        <LegalParagraph>
          You can disconnect your Gmail account at any time, which will revoke our access to your
          inbox. You can request deletion of your account and associated data by contacting us at{' '}
          <SupportEmailLink />.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data Retention">
        <LegalParagraph>
          We retain your data for as long as your account is active. If you cancel your account, we
          retain your data for 30 days in case you choose to resubscribe, after which it is
          permanently deleted. If you&apos;d like your data deleted sooner, contact us at{' '}
          <SupportEmailLink />.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Changes to This Policy">
        <LegalParagraph>
          We may update this policy from time to time. We will notify users of material changes.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Contact Us">
        <LegalParagraph>
          If you have questions about this policy or how your data is handled, contact us at{' '}
          <SupportEmailLink />.
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
