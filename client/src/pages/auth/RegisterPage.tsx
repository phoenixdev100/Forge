import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { fieldErrors } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { AuthLayout } from './AuthLayout';

function passwordHint(password: string): string | undefined {
  if (!password) return undefined;
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(password)) return 'Include at least one letter.';
  if (!/[0-9]/.test(password) && !/[^a-zA-Z0-9]/.test(password)) return 'Add a number or symbol.';
  return undefined;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = fieldErrors(error);
  const localPasswordError = passwordHint(password);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (localPasswordError) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await register({ name, email, password });
      navigate('/app/onboarding', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your personal gym system in a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <ErrorState error={error} compact title="Could not create your account" /> : null}

        <Input
          label="Your name"
          name="name"
          autoComplete="name"
          autoFocus
          required
          inputSize="lg"
          value={name}
          error={errors['name']}
          onChange={(event) => setName(event.target.value)}
          placeholder="Alex"
        />

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          inputSize="lg"
          value={email}
          error={errors['email']}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="new-password"
          required
          inputSize="lg"
          value={password}
          error={errors['password'] ?? localPasswordError}
          hint={localPasswordError ? undefined : 'At least 8 characters, with a letter and a number or symbol.'}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="flex size-8 items-center justify-center rounded text-text-subtle transition-colors hover:text-text"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          }
        />

        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} disabled={Boolean(localPasswordError)}>
          Create account
        </Button>

        <p className="text-xs leading-relaxed text-text-subtle">
          Your workout history, plans and measurements are private to your account. You can delete everything at any
          time from Settings.
        </p>
      </form>
    </AuthLayout>
  );
}
