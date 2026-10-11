/**
 * Renders the workout summary card as a PNG on a plain canvas - no image
 * dependency, and the output is identical for every user. Sharing prefers the
 * Web Share sheet; on desktop browsers it falls back to a downloaded PNG.
 */

import { formatDuration } from './format';
import { trimNumber, type Unit } from './units';
import type { WorkoutSession } from './types';

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The same barbell mark as the navbar logo, drawn with raw canvas paths. */
function drawMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.fillStyle = '#f97316';
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.28);
  ctx.fill();

  ctx.fillStyle = '#221a16';
  const bar = size * 0.66;
  const thick = size * 0.075;
  ctx.fillRect(cx - bar / 2, cy - thick / 2, bar, thick); // the bar
  for (const side of [-1, 1]) {
    ctx.fillRect(cx + side * bar * 0.32 - thick / 2, cy - size * 0.22, thick, size * 0.44); // outer plate
    ctx.fillRect(cx + side * bar * 0.18 - thick / 2, cy - size * 0.15, thick, size * 0.3); // inner plate
  }
}

function statTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
) {
  ctx.fillStyle = '#18181b';
  roundRect(ctx, x, y, w, 150, 24);
  ctx.fill();

  ctx.fillStyle = '#71717a';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label.toUpperCase(), x + w / 2, y + 48);

  ctx.fillStyle = '#fafafa';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillText(value, x + w / 2, y + 112);
}

export function renderWorkoutCard(session: WorkoutSession, unit: Unit): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas unavailable'));

  // Backdrop
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, W - 80, H - 80, 48);
  ctx.stroke();

  // Brand
  drawMark(ctx, W / 2, 150, 96);
  ctx.fillStyle = '#fafafa';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FORGE', W / 2, 250);

  // Title + date
  ctx.fillStyle = '#fafafa';
  ctx.font = '700 56px system-ui, sans-serif';
  const title = session.title.length > 24 ? `${session.title.slice(0, 24)}…` : session.title;
  ctx.fillText(title, W / 2, 360);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.fillText(session.date, W / 2, 412);

  // Muscles
  const groups = session.muscleGroups.map((m) => m.name).join('  ·  ');
  ctx.fillStyle = '#71717a';
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText(groups || 'Custom workout', W / 2, 470);

  // Stats grid (2 x 2)
  const tileW = (W - 160 - 24) / 2;
  const tileX = 80;
  const gap = 24;
  const volUnit = unit === 'LB' ? 'lb' : 'kg';
  statTile(ctx, tileX, 540, tileW, 'Duration', formatDuration(session.durationSeconds));
  statTile(ctx, tileX + tileW + gap, 540, tileW, 'Exercises', String(session.summary.completedExerciseCount));
  statTile(ctx, tileX, 714, tileW, 'Sets', String(session.summary.completedSetCount));
  const totalVolume = session.totalVolumeKg ?? 0;
  statTile(
    ctx,
    tileX + tileW + gap,
    714,
    tileW,
    'Volume',
    `${trimNumber(unit === 'LB' ? totalVolume * 2.20462 : totalVolume, 0)} ${volUnit}`,
  );

  // PR banner
  if (session.prCount > 0) {
    ctx.fillStyle = '#f97316';
    roundRect(ctx, 80, 920, W - 160, 110, 24);
    ctx.fill();
    ctx.fillStyle = '#221a16';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText(`${session.prCount} PERSONAL RECORD${session.prCount === 1 ? '' : 'S'}`, W / 2, 990);
  }

  // Footer
  ctx.fillStyle = '#52525b';
  ctx.font = '500 26px system-ui, sans-serif';
  ctx.fillText('Tracked set by set in Forge', W / 2, H - 100);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png'),
  );
}

/** Shares the card image; downloads it when the share sheet is unavailable. */
export async function shareWorkoutCard(session: WorkoutSession, unit: Unit): Promise<'shared' | 'downloaded'> {
  const blob = await renderWorkoutCard(session, unit);
  const file = new File([blob], `forge-${session.date}.png`, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `${session.title} - Forge` });
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
