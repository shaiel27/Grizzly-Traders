import sharp from 'sharp'
import { resolveBadges, type BadgeInput, type Badge } from './badges'

export const COVER_WIDTH = 1536
export const COVER_HEIGHT = 1024

const SIZE = 136
const OVERLAP = 28
const MARGIN_LEFT = 64
// Las tarjetas recortan las portadas a 16:9: las insignias quedan por encima de la franja que se pierde
const MARGIN_BOTTOM = 112

function badgeSvg(badge: Badge): string {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(badge.svg).toString('base64')}`
  const r = SIZE / 2
  // Corona oscura por fuera (separa las insignias que se solapan) y aro claro por dentro; sombra suave debajo
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SIZE + 24}" height="${SIZE + 24}" viewBox="0 0 ${SIZE + 24} ${SIZE + 24}">
<defs><clipPath id="c"><circle cx="${r + 12}" cy="${r + 12}" r="${r - 5}"/></clipPath><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter></defs>
<g filter="url(#s)"><circle cx="${r + 12}" cy="${r + 12}" r="${r}" fill="#0b0b0b"/>
<image href="${dataUri}" xlink:href="${dataUri}" x="${12 + 5}" y="${12 + 5}" width="${SIZE - 10}" height="${SIZE - 10}" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/>
<circle cx="${r + 12}" cy="${r + 12}" r="${r - 4}" fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="3"/></g></svg>`
}

// Oscurece la esquina inferior izquierda para que las insignias se lean sobre cualquier fondo
function scrimSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_WIDTH}" height="${COVER_HEIGHT}"><defs><radialGradient id="g" cx="0" cy="1" r="0.75" gradientTransform="translate(0 0)"><stop offset="0" stop-color="#000" stop-opacity=".72"/><stop offset=".55" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
}

export interface ComposeInput extends BadgeInput {
  image: Buffer
}

export interface ComposedCover {
  webp: Buffer
  badges: string[]
}

// Devuelve la portada en WebP de 1536×1024 con las insignias de banderas y activos abajo a la izquierda. Sin
// insignias solo ajusta el tamaño, así una noticia sin país ni activo claro sigue teniendo portada.
export async function composeCover({ image, flags, assets }: ComposeInput): Promise<ComposedCover> {
  const badges = resolveBadges({ flags, assets })
  let base = sharp(image).resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover', position: 'centre' })

  if (badges.length > 0) {
    const rendered = await Promise.all(badges.map((badge) => sharp(Buffer.from(badgeSvg(badge))).png().toBuffer()))
    const step = SIZE - OVERLAP
    const top = COVER_HEIGHT - MARGIN_BOTTOM - SIZE - 12
    base = sharp(await base.png().toBuffer()).composite([
      { input: Buffer.from(scrimSvg()), top: 0, left: 0 },
      ...rendered.map((input, index) => ({ input, top, left: MARGIN_LEFT - 12 + index * step })),
    ])
  }

  const webp = await base.webp({ quality: 84 }).toBuffer()
  return { webp, badges: badges.map((badge) => `${badge.kind}:${badge.id}`) }
}
