import { describe, expect, it } from 'vitest'
import { resolveSiteUrl } from './runtime'

const request = new Request('https://atacante.example/api/subscribe')

describe('resolveSiteUrl', () => {
  it('usa la URL configurada y le quita la barra final', () => {
    expect(resolveSiteUrl(request, { NEXT_PUBLIC_SITE_URL: 'https://grizzlytraders.example/', NODE_ENV: 'production' })).toBe('https://grizzlytraders.example')
  })

  it('en producción no se fía de la cabecera Host de la petición', () => {
    expect(resolveSiteUrl(request, { NODE_ENV: 'production' })).toBeNull()
  })

  it('fuera de producción usa el origen de la petición o localhost', () => {
    expect(resolveSiteUrl(new Request('http://localhost:3000/api/subscribe'), { NODE_ENV: 'development' })).toBe('http://localhost:3000')
    expect(resolveSiteUrl(undefined, { NODE_ENV: 'development' })).toBe('http://localhost:3000')
  })
})
