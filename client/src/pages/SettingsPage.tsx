import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, Monitor, Moon, ShieldAlert, Sun, User as UserIcon } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { NotificationPrefs, User } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/States';
import type { Unit } from '@/lib/units';

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium text-text">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-text-subtle">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
          aria-hidden
        />
      </button>
    </label>
  );
}

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

  const { data: prefsData, isPending: prefsLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api.get<{ preferences: NotificationPrefs }>('/users/me/notifications'),
  });

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

  const savePrefs = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/users/me/notifications', body),
    onSuccess: () => toast.success('Notification preferences saved.'),
    onError: (err) => toast.error(errorMessage(err)),
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

  const prefs = prefsData?.preferences;
  const profileErrors = fieldErrors(profileError);
  const pwErrors = fieldErrors(passwordError);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description={user.email} />

      <div className="space-y-5">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" icon={<UserIcon className="size-4" />} />
          <CardBody className="space-y-4 pt-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={profileErrors['name']} required />
            <div className="grid grid-cols-2 gap-4">
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
              <Button onClick={() => saveProfile.mutate()} isLoading={saveProfile.isPending} disabled={!name.trim()}>
                Save profile
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Units & theme */}
        <Card>
          <CardHeader title="Preferences" icon={<Moon className="size-4" />} />
          <CardBody className="space-y-5 pt-4">
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
                      'h-11 rounded-[var(--radius-control)] border text-sm font-medium transition-colors',
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
                      'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border text-sm font-medium transition-colors',
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

        {/* Notifications */}
        <Card>
          <CardHeader title="Notifications" description="Gentle nudges only - nothing pings without your say-so." />
          <CardBody className="divide-y divide-border pt-2">
            {prefsLoading || !prefs ? (
              <PageLoader />
            ) : (
              <>
                <Toggle
                  label="Workout reminders"
                  description="A nudge on scheduled training days."
                  checked={prefs.workoutReminder}
                  onChange={(v) => savePrefs.mutate({ workoutReminder: v })}
                />
                <Toggle
                  label="PR notifications"
                  description="Tell me when I break a record."
                  checked={prefs.prNotification}
                  onChange={(v) => savePrefs.mutate({ prNotification: v })}
                />
                <Toggle
                  label="Streak reminders"
                  description="Warn me before a streak day slips away."
                  checked={prefs.streakReminder}
                  onChange={(v) => savePrefs.mutate({ streakReminder: v })}
                />
                <Toggle
                  label="Goal reminders"
                  description="Occasional check-ins on open goals."
                  checked={prefs.goalReminder}
                  onChange={(v) => savePrefs.mutate({ goalReminder: v })}
                />
              </>
            )}
          </CardBody>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader title="Security" icon={<KeyRound className="size-4" />} />
          <CardBody className="space-y-4 pt-4">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
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

        {/* Danger zone */}
        <Card className="border-danger/30">
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
