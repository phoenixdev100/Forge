import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Development returns a reset link directly so the flow is testable without email. */
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.post<{ message: string; devResetLink?: string | null }>('/auth/forgot-password', {
        email,
      });
      setDevResetLink(result.devResetLink ?? null);
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle={null}>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <MailCheck className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-text">If an account exists for {email}, a reset link is on its way.</p>
              <p className="mt-1.5 text-sm text-text-muted">
                The link expires in an hour. If nothing arrives, check spam or try a different address.
              </p>
            </div>
          </div>

          {devResetLink ? (
            <div className="mt-4 rounded-[var(--radius-control)] border border-info/30 bg-info-soft p-3">
              <p className="text-xs font-medium text-info">Development mode - no email was sent.</p>
              <Link
                to={new URL(devResetLink, window.location.origin).pathname + new URL(devResetLink, window.location.origin).search}
                className="mt-1 block truncate text-sm font-medium text-info underline"
              >
                Open the reset link
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button variant="secondary" onClick={() => setSent(false)}>
            Use a different email
          </Button>
          <Link to="/login" className="text-sm font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email on your account and we will send you a reset link."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <ErrorState error={error} compact /> : null}
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          required
          inputSize="lg"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
