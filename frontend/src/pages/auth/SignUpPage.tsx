import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SignUpForm } from '@/features/accounts';
import { AUTH_LINK, AuthLayout } from './AuthLayout';

export function SignUpPage() {
  const [created, setCreated] = useState(false);

  if (created) {
    return (
      <AuthLayout
        title="Account created"
        footer={
          <Link to="/sign-in" className={AUTH_LINK}>
            Back to sign in
          </Link>
        }
      >
        <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success">
          Account created. reyxdz needs to approve it before you can sign in.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Use your @sourceone.global email. An admin approves it before you can sign in."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" className={AUTH_LINK}>
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm onSignedUp={() => setCreated(true)} />
    </AuthLayout>
  );
}