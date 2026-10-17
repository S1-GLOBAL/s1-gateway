import { AuthLayout } from './AuthLayout';

/** `/sign-up` stays, so an old link or bookmark says why there is no form (ADR 0023). */
export function SignUpPage() {
  return <AuthLayout title="The Gateway is invite-only." description="Ask a Gateway admin for an invite link." />;
}
