import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mismatch) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="This reset link is not valid" subtitle="The link may have expired or already been used.">
        <Link
          to="/forgot-password"
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={done ? 'Password updated' : 'Choose a new password'}
      subtitle={done ? 'You can sign in with your new password now.' : 'Pick a password you have not used elsewhere.'}
    >
      {done ? (
        <Link
          to="/login"
          className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-accent px-5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Continue to sign in
        </Link>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? <ErrorState error={error} compact title="Could not reset your password" /> : null}
          <Input
            label="New password"
            type="password"
            name="password"
            autoComplete="new-password"
            autoFocus
            required
            inputSize="lg"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 8 characters, with a letter and a number or symbol."
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            inputSize="lg"
            value={confirm}
            error={mismatch ? 'The passwords do not match.' : undefined}
            onChange={(event) => setConfirm(event.target.value)}
          />
          <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} disabled={mismatch}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
