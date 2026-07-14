import { Link } from 'react-router-dom'
import { SupportEmailLink } from '../ui/SupportEmailLink'
import {
  LegalDocumentLayout,
  LegalList,
  LegalParagraph,
  LegalSection,
} from './LegalDocumentLayout'

export function TermsOfServicePage() {
  return (
    <LegalDocumentLayout title="CreatorExec Terms of Service" lastUpdated="July 14, 2026">
      <LegalParagraph>
        These Terms of Service (&quot;Terms&quot;) govern your use of CreatorExec, operated by MCK
        Creative Group LLC (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;). By creating an account
        or using CreatorExec, you agree to these Terms.
      </LegalParagraph>

      <LegalSection title="1. The Service">
        <LegalParagraph>
          CreatorExec is a software tool for TikTok Shop affiliate creators, providing product tier
          analysis, sprint scheduling, product opportunity scoring (Product Scout), brand deal
          tracking, and income tracking based on data you provide.
        </LegalParagraph>
        <LegalParagraph>
          CreatorExec is currently in beta. Features may change, be added, or be removed without
          notice. Bugs and interruptions may occur. We&apos;ll do our best to communicate major
          changes, but beta software is inherently a work in progress.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. No Guarantee of Results">
        <LegalParagraph>
          CreatorExec provides data analysis, scheduling suggestions, and scoring based on the
          information you input and general patterns. We do not guarantee any specific outcome,
          income, sales, or business result from using CreatorExec. Product tier rankings, sprint
          schedules, and Product Scout verdicts are recommendations based on available data — not
          promises or predictions.
        </LegalParagraph>
        <LegalParagraph>
          You are solely responsible for your own content, posting decisions, and business outcomes.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Not Financial, Tax, or Legal Advice">
        <LegalParagraph>
          Nothing in CreatorExec — including the income tracker, commission analysis, or any other
          feature — constitutes financial, tax, accounting, or legal advice. Consult a qualified
          professional for decisions related to your business finances or taxes.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Your Account">
        <LegalParagraph>
          You&apos;re responsible for keeping your account credentials secure and for all activity
          under your account. You must provide accurate information when creating an account.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Your Data">
        <LegalParagraph>
          You retain ownership of the data you upload (commission reports, product information,
          etc.). We use this data to provide the Service to you, as described in our{' '}
          <Link to="/privacy" className="link-elegant font-medium text-ink">
            Privacy Policy
          </Link>
          .
        </LegalParagraph>
        <LegalParagraph>
          If you cancel your account, we retain your data for 30 days after cancellation, in case you
          choose to resubscribe — your sprint history, tier data, and trial progress will be waiting
          for you. After 30 days with no resubscription, your data is permanently deleted.
        </LegalParagraph>
        <LegalParagraph>
          If you&apos;d like your data deleted sooner, you may request immediate deletion at any time
          by contacting us at <SupportEmailLink />.
        </LegalParagraph>
      </LegalSection>

      {/* LEGAL REVIEW FLAG: Section 6 drafted for 7-day free trial model (replacing
          prior 7-day money-back refund window for NEW checkouts). Confirm wording
          before treating as final legal copy. Existing subscribers who purchased
          under prior refund terms are called out below. */}
      <LegalSection title="6. Payment, Cancellation, and Refunds">
        <LegalParagraph>
          <strong className="font-medium text-ink">Billing:</strong> CreatorExec is offered on a
          subscription basis. When you subscribe through Checkout, you provide a payment method and
          authorize us to charge it on a recurring basis after any applicable trial ends, until you
          cancel.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="font-medium text-ink">Free trial:</strong> New subscriptions started
          through Checkout include a 7-day free trial. Your payment method is collected at signup,
          but you will not be charged until the trial ends. If you cancel before the trial ends, you
          will not be charged for that subscription. When the trial ends without cancellation, your
          paid subscription begins and renews on the billing interval selected at signup.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="font-medium text-ink">Cancellation:</strong> You may cancel your
          subscription at any time. Cancellation stops future billing; you&apos;ll retain access
          through the end of your current paid period (or through the end of your trial, if you
          cancel during a trial).
        </LegalParagraph>
        <LegalParagraph>
          <strong className="font-medium text-ink">Refunds:</strong> Payments are generally
          non-refundable after a charge is successfully processed, since the 7-day free trial gives
          you a no-charge way to try CreatorExec before committing. That said, if you feel you need
          or deserve a refund for any reason, please reach out to <SupportEmailLink /> — we&apos;ll
          take a look. Subscribers who purchased under prior money-back guarantee terms (before this
          free-trial model) may still contact us at <SupportEmailLink /> about those prior terms.
        </LegalParagraph>
        <LegalParagraph>
          <strong className="font-medium text-ink">Price changes:</strong> We may change subscription
          pricing. If we do, we&apos;ll provide notice before the change applies to your next billing
          cycle.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Acceptable Use">
        <LegalParagraph>You agree not to:</LegalParagraph>
        <LegalList
          items={[
            'Use CreatorExec for any unlawful purpose',
            'Attempt to reverse-engineer, resell, or redistribute the Service without our permission',
            'Share your account access with others outside your own business use',
            "Upload data you don't have the right to use",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Account Termination">
        <LegalParagraph>
          We may suspend or terminate your account if you violate these Terms, engage in abusive
          behavior, or fail to pay applicable fees. You may also close your account at any time.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Limitation of Liability">
        <LegalParagraph>
          To the fullest extent permitted by law, MCK Creative Group LLC is not liable for any
          indirect, incidental, or consequential damages arising from your use of CreatorExec,
          including lost profits, lost data, or business interruption. Our total liability for any
          claim related to the Service is limited to the amount you paid us in the 3 months prior to
          the claim.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Changes to These Terms">
        <LegalParagraph>
          We may update these Terms from time to time. We&apos;ll notify users of material changes.
          Continued use of CreatorExec after changes take effect means you accept the updated Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="11. Governing Law">
        <LegalParagraph>
          These Terms are governed by the laws of Texas, without regard to conflict of law
          principles.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalParagraph>
          Questions about these Terms? Contact us at <SupportEmailLink />.
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
