export type ShareCardTheme = 'mint';

export interface ShareCardOptions {
  score: number;
  rarity?: string;
  level?: number;
  subtitle?: string;
  width?: number;
  height?: number;
  theme?: ShareCardTheme;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export async function createShareCardDataUrl(opts: ShareCardOptions): Promise<string> {
  const width = opts.width ?? 1200;
  const height = opts.height ?? 630;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#22c55e');
  bg.addColorStop(0.55, '#60a5fa');
  bg.addColorStop(1, '#a855f7');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle glow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(width * 0.2, height * 0.25, width * 0.18, height * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width * 0.85, height * 0.78, width * 0.22, height * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Main card panel
  const pad = Math.round(width * 0.07);
  const cardX = pad;
  const cardY = pad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.stroke();

  // Typography
  const title = 'MemoryMint';
  const subtitle = opts.subtitle ?? 'Score Card';
  const scoreText = opts.score.toLocaleString();
  const rarityText = opts.rarity ? String(opts.rarity) : '—';
  const levelText = typeof opts.level === 'number' ? `Level ${opts.level}` : 'Level';

  const left = cardX + Math.round(cardW * 0.085);
  const top = cardY + Math.round(cardH * 0.16);

  // Header
  ctx.fillStyle = '#111827';
  ctx.font = '700 72px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(title, left, top);

  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = '500 34px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(subtitle, left, top + 52);

  // Score block
  const scoreY = top + 170;
  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = '600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText('SCORE', left, scoreY);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 110px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(scoreText, left, scoreY + 110);

  // Right stats pill
  const pillW = Math.round(cardW * 0.36);
  const pillH = Math.round(cardH * 0.22);
  const pillX = cardX + cardW - pillW - Math.round(cardW * 0.085);
  const pillY = scoreY - 10;

  ctx.fillStyle = 'rgba(17,24,39,0.06)';
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, 28);
  ctx.fill();

  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = '600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText('RARITY', pillX + 28, pillY + 54);

  ctx.fillStyle = '#6d28d9';
  ctx.font = '800 52px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(rarityText, pillX + 28, pillY + 115);

  ctx.fillStyle = 'rgba(17,24,39,0.65)';
  ctx.font = '600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText(levelText, pillX + 28, pillY + 158);

  // Footer brand line
  const footerY = cardY + cardH - 50;
  ctx.fillStyle = 'rgba(17,24,39,0.55)';
  ctx.font = '600 28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillText('Play • Match • Mint', left, footerY);

  return canvas.toDataURL('image/png');
}
