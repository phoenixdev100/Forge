import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  ShieldAlert,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { api, apiDownload, errorMessage, fieldErrors } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { User } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/States';
import type { Unit } from '@/lib/units';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Profile
  const [name, setName] = useState(user?.name ?? '');
  const [goal, setGoal] = useState(user?.goal ?? '');
  const [experience, setExperience] = useState(user?.experience ?? '');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(user?.trainingDaysPerWeek ?? null);
  const [unit, setUnit] = useState<Unit>(user?.unit ?? 'KG');
  const [weekStartsOn, setWeekStartsOn] = useState(user?.weekStartsOn ?? 1);
  const [profileError, setProfileError] = useState<unknown>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<unknown>(null);

  // Danger
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Export
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);

  async function download(format: 'json' | 'csv') {
    setExporting(format);
    try {
      await apiDownload('/users/me/export', { format });
      toast.success(format === 'csv' ? 'Set-by-set CSV downloaded.' : 'Full archive downloaded.');
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed. Please try again.'));
    } finally {
      setExporting(null);
    }
  }

  const saveProfile = useMutation({
    mutationFn: () =>
      api.patch<{ user: User }>('/users/me', {
        name: name.trim(),
        goal: goal || null,
        experience: experience || null,
        trainingDaysPerWeek: daysPerWeek,
        unit,
        weekStartsOn,
      }),
    onSuccess: ({ user: updated }) => {
      setUser(updated);
      toast.success('Profile saved.');
    },
    onError: setProfileError,
  });

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated - other devices were signed out.');
    },
    onError: setPasswordError,
  });

  const logoutAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSuccess: () => {
      // Clears this device's cookies too - go to login.
      void logout().catch(() => undefined);
      navigate('/login', { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/users/me'),
    onSuccess: () => {
      void logout().catch(() => undefined);
      navigate('/login', { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!user) return <PageLoader />;

  const profileErrors = fieldErrors(profileError);
  const pwErrors = fieldErrors(passwordError);

  return (
    <div>
      <PageHeader
        title="Settings"
        description={user.email}
        action={
          <ButtonLink variant="secondary" size="sm" to="/app/profile" leftIcon={<UserIcon className="size-4" />}>
            Your profile
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* Columns flatten on mobile (contents) so DOM order can differ from visual order */}
        <div className="flex flex-col gap-5 max-lg:contents">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" icon={<UserIcon className="size-4" />} />
          <CardBody className="space-y-4 pt-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={profileErrors['name']} required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
                <option value="">Not set</option>
                <option value="BUILD_MUSCLE">Build muscle</option>
                <option value="STRENGTH">Strength</option>
                <option value="FAT_LOSS">Fat loss</option>
                <option value="GENERAL_FITNESS">General fitness</option>
                <option value="CUSTOM">Custom</option>
              </Select>
              <Select label="Experience" value={experience} onChange={(e) => setExperience(e.target.value)}>
                <option value="">Not set</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </Select>
              <Select
                label="Training days/week"
                value={daysPerWeek ?? ''}
                onChange={(e) => setDaysPerWeek(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">Not set</option>
                {[2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </Select>
              <Select label="Week starts on" value={weekStartsOn} onChange={(e) => setWeekStartsOn(Number(e.target.value))}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
                <option value={6}>Saturday</option>
              </Select>
            </div>
            {profileError ? <p role="alert" className="text-sm text-danger">{errorMessage(profileError)}</p> : null}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => saveProfile.mutate()} isLoading={saveProfile.isPending} disabled={!name.trim()}>
                Save profile
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Data ownership - an export that outlives this app */}
        <Card>
          <CardHeader title="Your data" icon={<Download className="size-4" />} />
          <CardBody className="space-y-3 pt-4">
            <p className="text-sm text-text-muted">
              Download everything you have logged - plans, every set, records, goals and measurements. No account
              required to read it afterwards.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                isLoading={exporting === 'json'}
                onClick={() => void download('json')}
                leftIcon={<FileJson className="size-4" />}
              >
                Full archive (JSON)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                isLoading={exporting === 'csv'}
                onClick={() => void download('csv')}
                leftIcon={<FileSpreadsheet className="size-4" />}
              >
                Every set (CSV)
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Danger zone - always the last card on a phone */}
        <Card className="border-danger/30 max-lg:order-4">
          <CardHeader title="Account" icon={<ShieldAlert className="size-4" />} />
          <CardBody className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text">Delete account</p>
                <p className="mt-0.5 text-xs text-text-subtle">
                  Your workouts are retained anonymously for reference but the account can't sign in again.
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
            </div>
          </CardBody>
        </Card>
        </div>

        <div className="flex flex-col gap-5 max-lg:contents">
        {/* Units & theme */}
        <Card>
          <CardHeader title="Preferences" icon={<Moon className="size-4" />} />
          <CardBody className="space-y-4 pt-4">
            <div>
              <p className="mb-2 text-sm font-medium text-text">Weight unit</p>
              <div className="grid grid-cols-2 gap-2">
                {(['KG', 'LB'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={cn(
                      'h-9 rounded-[var(--radius-control)] border text-sm font-medium transition-colors',
                      unit === u ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-muted hover:border-border-strong',
                    )}
                  >
                    {u === 'KG' ? 'Kilograms (kg)' : 'Pounds (lb)'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-text-subtle">Display only - history stays correct when you switch.</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-text">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    aria-pressed={theme === t.value}
                    className={cn(
                      'flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border text-sm font-medium transition-colors',
                      theme === t.value ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-muted hover:border-border-strong',
                    )}
                  >
                    <t.icon className="size-4" aria-hidden />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader title="Security" icon={<KeyRound className="size-4" />} />
          <CardBody className="space-y-3 pt-4">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={pwErrors['newPassword']}
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={newPassword && confirmPassword && newPassword !== confirmPassword ? "Doesn't match." : undefined}
              />
            </div>
            {passwordError ? <p role="alert" className="text-sm text-danger">{errorMessage(passwordError)}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                className="h-9"
                onClick={() => changePassword.mutate()}
                isLoading={changePassword.isPending}
                disabled={!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
              >
                Change password
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLogoutAllOpen(true)} leftIcon={<LogOut className="size-4" />}>
                Sign out everywhere
              </Button>
            </div>
          </CardBody>
        </Card>
        </div>
      </div>

      <ConfirmDialog
        open={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        onConfirm={() => logoutAll.mutate()}
        isLoading={logoutAll.isPending}
        title="Sign out everywhere?"
        description="Every device using this account is signed out, including this one."
        confirmLabel="Sign out everywhere"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteAccount.mutate()}
        isLoading={deleteAccount.isPending}
        title="Delete your account?"
        description="You won't be able to sign in again. This cannot be undone."
        confirmLabel="Delete account"
      />
    </div>
  );
}
