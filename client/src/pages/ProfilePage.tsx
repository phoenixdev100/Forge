import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Dumbbell,
  Flame,
  Pencil,
  Repeat,
  Ruler,
  Settings as SettingsIcon,
  Target,
  TrendingUp,
  Trophy,
  User as UserIcon,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import type { BodyMeasurement, ProgressOverview, Sex, User } from '@/lib/types';
import { fromCm, fromKg, lengthLabel, toCm, toKg, trimNumber, unitLabel } from '@/lib/units';
import { formatVolume } from '@/lib/units';
import { toast } from 'sonner';
import { useAuth, useUnit } from '@/providers/AuthProvider';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { PageLoader } from '@/components/ui/States';

const SEX_LABELS: Record<Sex, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

const GOAL_LABELS: Record<string, string> = {
  BUILD_MUSCLE: 'Build muscle',
  STRENGTH: 'Get stronger',
  FAT_LOSS: 'Lose fat',
  GENERAL_FITNESS: 'General fitness',
  CUSTOM: 'Something else',
};

const EXPERIENCE_LABELS: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

const WEEK_START_LABELS: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 6: 'Saturday' };

/** Whole years, counted honestly - no rounding up on a birthday month. */
function ageFrom(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** A single "label / value" line. Anything unset says so rather than hiding. */
function DetailRow({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-right">
        <span className={value ? 'text-sm font-medium text-text' : 'text-sm text-text-subtle'}>
          {value ?? 'Not set'}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-text-subtle">{hint}</span> : null}
      </span>
    </div>
  );
}

/** Body details live here rather than in Settings - this is the profile's own data. */
function EditBodyDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const { setUser } = useAuth();
  const unit = user.unit;
  const [sex, setSex] = useState<string>(user.sex ?? '');
  const [height, setHeight] = useState(user.heightCm != null ? String(fromCm(user.heightCm, unit)) : '');
  const [weight, setWeight] = useState(user.bodyWeightKg != null ? String(fromKg(user.bodyWeightKg, unit)) : '');
  const [dob, setDob] = useState(user.dateOfBirth ?? '');

  const save = useMutation({
    mutationFn: () => {
      const heightValue = Number(height);
      const weightValue = Number(weight);
      return api.patch<{ user: User }>('/users/me', {
        sex: sex || null,
        heightCm: height.trim() && heightValue > 0 ? toCm(heightValue, unit) : null,
        bodyWeightKg: weight.trim() && weightValue > 0 ? toKg(weightValue, unit) : null,
        dateOfBirth: dob || null,
      });
    },
    onSuccess: ({ user: updated }) => {
      setUser(updated);
      toast.success('Profile updated.');
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Body details"
      description="All optional. Only you ever see this."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Sex" value={sex} onChange={(e) => setSex(e.target.value)}>
          <option value="">Not set</option>
          {(Object.keys(SEX_LABELS) as Sex[]).map((value) => (
            <option key={value} value={value}>{SEX_LABELS[value]}</option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={`Height (${lengthLabel(unit)})`}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
          <Input
            label={`Body weight (${unitLabel(unit)})`}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <Input
          label="Date of birth"
          type="date"
          value={dob}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDob(e.target.value)}
          hint="Used only to show your age here."
        />
      </div>
    </Dialog>
  );
}

/**
 * Everything the user has ever told Forge about themselves, in one place:
 * who they are, their body details, how they train, and what that has added
 * up to. Read-first - editing is one tap away but never in the way.
 */
export default function ProfilePage() {
  const { user } = useAuth();
  const unit = useUnit();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: progress } = useQuery({
    queryKey: qk.progress({ weeks: 12 }),
    queryFn: () => api.get<ProgressOverview>('/progress', { query: { weeks: 12 } }),
  });

  const { data: measurementData } = useQuery({
    queryKey: qk.measurements,
    queryFn: () => api.get<{ measurements: BodyMeasurement[] }>('/measurements'),
  });

  if (!user) return <PageLoader />;

  const age = ageFrom(user.dateOfBirth);
  const totals = progress?.totals;
  const streak = progress?.streak;
  const latest = measurementData?.measurements?.[0] ?? null;

  // BMI is only meaningful with both numbers, and is context - never a verdict.
  const bmi =
    user.heightCm && user.bodyWeightKg
      ? user.bodyWeightKg / (user.heightCm / 100) ** 2
      : null;

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const measurementRows: Array<[string, number | null]> = latest
    ? [
        ['Body fat', latest.bodyFatPct],
        ['Neck', latest.neckCm],
        ['Shoulders', latest.shouldersCm],
        ['Chest', latest.chestCm],
        ['Waist', latest.waistCm],
        ['Hips', latest.hipsCm],
        ['Left arm', latest.leftArmCm],
        ['Right arm', latest.rightArmCm],
        ['Left thigh', latest.leftThighCm],
        ['Right thigh', latest.rightThighCm],
        ['Left calf', latest.leftCalfCm],
        ['Right calf', latest.rightCalfCm],
      ]
    : [];
  const loggedMeasurements = measurementRows.filter(([, value]) => value != null);

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Everything you have told Forge about yourself."
        action={
          <ButtonLink variant="secondary" size="sm" to="/app/settings" leftIcon={<SettingsIcon className="size-4" />}>
            Settings
          </ButtonLink>
        }
      />

      <div className="space-y-5">
        {/* Who you are */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
                  {initials || <UserIcon className="size-6" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-text">{user.name}</h2>
                  {user.role === 'ADMIN' ? <Badge tone="accent" size="sm">Admin</Badge> : null}
                </div>
                <p className="truncate text-sm text-text-muted">{user.email}</p>
                <p className="mt-0.5 text-xs text-text-subtle">
                  Training with Forge since {formatDate(user.createdAt, 'd MMM yyyy')}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* What it has added up to */}
        {totals ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Workouts" value={totals.totalWorkouts} icon={<Dumbbell className="size-4" />} />
            <StatTile label="Sets" value={totals.totalSets} icon={<Repeat className="size-4" />} />
            <StatTile label="Volume" value={formatVolume(totals.totalVolumeKg, unit)} icon={<TrendingUp className="size-4" />} />
            <StatTile
              label="Streak"
              value={`${streak?.current ?? 0}d`}
              sub={streak ? `best ${streak.longest}d` : undefined}
              icon={<Flame className="size-4" />}
              tone="accent"
            />
          </div>
        ) : null}

        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* Body details */}
          <Card>
            <CardHeader
              title="Body"
              description="Your own numbers - never used to gate anything."
              icon={<Ruler className="size-4" />}
              action={
                <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} leftIcon={<Pencil className="size-3.5" />}>
                  Edit
                </Button>
              }
            />
            <CardBody className="pt-2">
              <DetailRow label="Sex" value={user.sex ? SEX_LABELS[user.sex] : null} />
              <DetailRow
                label="Date of birth"
                value={user.dateOfBirth ? formatDate(user.dateOfBirth, 'd MMM yyyy') : null}
                hint={age != null ? `${age} years old` : undefined}
              />
              <DetailRow
                label="Height"
                value={user.heightCm != null ? `${trimNumber(fromCm(user.heightCm, unit), 1)} ${lengthLabel(unit)}` : null}
              />
              <DetailRow
                label="Body weight"
                value={user.bodyWeightKg != null ? `${trimNumber(fromKg(user.bodyWeightKg, unit), 1)} ${unitLabel(unit)}` : null}
                hint={latest ? `last measured ${formatDate(latest.measuredOn, 'd MMM')}` : undefined}
              />
              <DetailRow label="BMI" value={bmi != null ? trimNumber(bmi, 1) : null} hint={bmi != null ? 'height and weight only - not a verdict' : undefined} />
            </CardBody>
          </Card>

          {/* How you train */}
          <Card>
            <CardHeader title="Training" description="Set during onboarding, editable in settings." icon={<Target className="size-4" />} />
            <CardBody className="pt-2">
              <DetailRow label="Goal" value={user.goal ? GOAL_LABELS[user.goal] ?? user.goal : null} />
              <DetailRow label="Experience" value={user.experience ? EXPERIENCE_LABELS[user.experience] ?? user.experience : null} />
              <DetailRow
                label="Days per week"
                value={user.trainingDaysPerWeek != null ? `${user.trainingDaysPerWeek} days` : null}
              />
              <DetailRow label="Weight unit" value={unit === 'LB' ? 'Pounds (lb)' : 'Kilograms (kg)'} />
              <DetailRow label="Week starts on" value={WEEK_START_LABELS[user.weekStartsOn] ?? `Day ${user.weekStartsOn}`} />
              <DetailRow label="Time zone" value={user.timezone} />
              <DetailRow
                label="Onboarding"
                value={user.onboardedAt ? `Completed ${formatDate(user.onboardedAt, 'd MMM yyyy')}` : 'Skipped'}
              />
            </CardBody>
          </Card>
        </div>

        {/* Latest measurements, if the user tracks them */}
        <Card>
          <CardHeader
            title="Latest measurements"
            description={latest ? `Measured ${formatDate(latest.measuredOn, 'd MMM yyyy')}` : 'Nothing logged yet'}
            icon={<CalendarDays className="size-4" />}
            action={
              <ButtonLink variant="ghost" size="sm" to="/app/goals">
                {latest ? 'Update' : 'Add measurements'}
              </ButtonLink>
            }
          />
          <CardBody className="pt-4">
            {loggedMeasurements.length ? (
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
                {loggedMeasurements.map(([label, value]) => (
                  <DetailRow
                    key={label}
                    label={label}
                    value={
                      label === 'Body fat'
                        ? `${trimNumber(value as number, 1)}%`
                        : `${trimNumber(fromCm(value as number, unit), 1)} ${lengthLabel(unit)}`
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                Body measurements are optional. Log them on the{' '}
                <Link to="/app/goals" className="font-medium text-accent hover:underline">Goals</Link> page and the
                latest set shows up here.
              </p>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-wrap gap-2">
          <ButtonLink variant="secondary" size="sm" to="/app/records" leftIcon={<Trophy className="size-4" />}>
            Personal records
          </ButtonLink>
          <ButtonLink variant="secondary" size="sm" to="/app/achievements" leftIcon={<Flame className="size-4" />}>
            Achievements
          </ButtonLink>
          <ButtonLink variant="secondary" size="sm" to="/app/progress" leftIcon={<TrendingUp className="size-4" />}>
            Progress
          </ButtonLink>
        </div>
      </div>

      {editOpen ? (
        <EditBodyDialog
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            void queryClient.invalidateQueries({ queryKey: qk.measurements });
          }}
          user={user}
        />
      ) : null}
    </div>
  );
}
