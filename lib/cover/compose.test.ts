import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { isKnownFlag, MAX_BADGES, resolveBadges } from './badges'
import { composeCover, COVER_HEIGHT, COVER_WIDTH } from './compose'

const ids = (input: Parameters<typeof resolveBadges>[0]) => resolveBadges(input).map((b) => `${b.kind}:${b.id}`)

async function base(width = 900, height = 900) {
  return sharp({ create: { width, height, channels: 3, background: '#335577' } }).png().toBuffer()
}

describe('insignias de la portada', () => {
  it('traduce símbolos del catálogo a su logo', () => {
    expect(ids({ assets: ['BTC'] })).toEqual(['crypto:BTC'])
    expect(ids({ assets: ['XAUUSD'] })).toEqual(['glyph:XAUUSD'])
    expect(ids({ assets: ['gold'] })).toEqual(['glyph:XAUUSD'])
    expect(ids({ assets: ['BRENT'] })).toEqual(['glyph:OIL'])
    expect(ids({ assets: ['POL'] })).toEqual(['crypto:MATIC'])
  })

  it('un par de divisas lleva las dos banderas y un índice la de su mercado', () => {
    expect(ids({ assets: ['EURUSD'] })).toEqual(['flag:EU', 'flag:US'])
    expect(ids({ assets: ['DAX'] })).toEqual(['flag:DE'])
  })

  it('los activos van antes que las banderas, sin repetir y con tope', () => {
    expect(ids({ flags: ['us', 'DE'], assets: ['BTC'] })).toEqual(['crypto:BTC', 'flag:US', 'flag:DE'])
    expect(ids({ flags: ['US', 'US'], assets: ['SPX'] })).toEqual(['flag:US'])
    expect(resolveBadges({ flags: ['US', 'DE', 'FR', 'GB', 'JP', 'CN'], assets: ['BTC', 'ETH'] })).toHaveLength(MAX_BADGES)
  })

  it('ignora lo desconocido: acciones sueltas, banderas inventadas y texto raro', () => {
    expect(ids({ flags: ['ZZ', '', '<script>'], assets: ['AAPL', '', 'NOPE'] })).toEqual([])
    expect(isKnownFlag('us')).toBe(true)
    expect(isKnownFlag('zz')).toBe(false)
  })
})

describe('composeCover', () => {
  it('sin insignias solo redimensiona a 1536×1024 en WebP', async () => {
    const { webp, badges } = await composeCover({ image: await base() })
    const meta = await sharp(webp).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', COVER_WIDTH, COVER_HEIGHT])
    expect(badges).toEqual([])
  })

  it('con insignias dibuja los círculos abajo a la izquierda y deja el resto intacto', async () => {
    const image = await base(COVER_WIDTH, COVER_HEIGHT)
    const plain = await sharp((await composeCover({ image })).webp).raw().toBuffer({ resolveWithObject: true })
    const withBadges = await composeCover({ image, flags: ['US'], assets: ['BTC', 'XAUUSD'] })
    expect(withBadges.badges).toEqual(['crypto:BTC', 'glyph:XAUUSD', 'flag:US'])
    const raw = await sharp(withBadges.webp).raw().toBuffer({ resolveWithObject: true })
    const px = (data: Buffer, w: number, x: number, y: number) => [0, 1, 2].map((c) => data[(y * w + x) * 3 + c])
    // esquina superior derecha: igual que sin insignias
    expect(px(raw.data, raw.info.width, 1400, 60)).toEqual(px(plain.data, plain.info.width, 1400, 60))
    // centro del primer círculo: distinto del fondo liso
    const cx = 64 + 68
    const cy = COVER_HEIGHT - 112 - 68
    expect(px(raw.data, raw.info.width, cx, cy)).not.toEqual(px(plain.data, plain.info.width, cx, cy))
  })

  it('rechaza algo que no es una imagen', async () => {
    await expect(composeCover({ image: Buffer.from('no soy una imagen') })).rejects.toThrow()
  })
})
