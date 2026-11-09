import { describe, expect, it } from 'vitest'
import { contenidoAdsTxt, espaciosDeAnuncios, esHostValido, hostsDeAnuncios, urlDelAnuncio } from './publicidad'

const banner = { tipo: 'banner', clave: 'abcdef1234567890', host: 'www.ejemplo-ads.com', ancho: 300, alto: 250 }

describe('espacios publicitarios', () => {
  it('acepta un banner y un nativo bien formados', () => {
    const e = espaciosDeAnuncios(JSON.stringify({ articulo: banner, nativo: { tipo: 'nativo', clave: 'ZZZZ1234abcd', host: 'pl1.Ejemplo-Ads.com' } }))
    expect(e.articulo).toEqual(banner)
    expect(e.nativo).toEqual({ tipo: 'nativo', clave: 'ZZZZ1234abcd', host: 'pl1.ejemplo-ads.com' })
    expect(urlDelAnuncio(e.articulo)).toBe('https://www.ejemplo-ads.com/abcdef1234567890/invoke.js')
  })

  it('un espacio mal escrito se descarta (queda apagado) sin romper los demás', () => {
    const e = espaciosDeAnuncios(
      JSON.stringify({
        bueno: banner,
        claveCorta: { ...banner, clave: 'abc' },
        claveRara: { ...banner, clave: 'abc"><script>alert(1)</script>' },
        hostConRuta: { ...banner, host: 'ejemplo.com/ruta' },
        hostConProtocolo: { ...banner, host: 'https://ejemplo.com' },
        hostComodin: { ...banner, host: '*.ejemplo.com' },
        sinTamano: { ...banner, ancho: 0 },
        tamanoEnorme: { ...banner, ancho: 5000 },
        tamanoTexto: { ...banner, alto: '250' },
        tipoRaro: { ...banner, tipo: 'popunder' },
        'Nombre Malo': banner,
      })
    )
    expect(Object.keys(e)).toEqual(['bueno'])
  })

  it('un JSON ilegible o de otra forma deja todo apagado', () => {
    for (const malo of [undefined, null, '', 'no es json', '[]', 'null', '"texto"', '{']) expect(espaciosDeAnuncios(malo)).toEqual({})
  })

  it('valida direcciones de servidor: sin esquema, ruta, puerto ni espacios', () => {
    for (const ok of ['ejemplo.com', 'www.ejemplo.com', 'a-b.c-d.example.io', '*.ejemplo.com']) expect(esHostValido(ok)).toBe(true)
    for (const mal of ['', 'ejemplo', 'ejemplo.com/x', 'https://ejemplo.com', 'ejemplo.com:8080', 'ej emplo.com', '-a.com', "ejemplo.com'", 5, null]) expect(esHostValido(mal)).toBe(false)
  })

  it('lista de servidores extra: sin repetidos y descartando los inválidos', () => {
    expect(hostsDeAnuncios(' A.com , b.org,a.com,http://x.com,, *.cdn.net ')).toEqual(['a.com', 'b.org', '*.cdn.net'])
    expect(hostsDeAnuncios(undefined)).toEqual([])
  })
})

describe('ads.txt', () => {
  it('conserva solo líneas con forma de ads.txt (y comentarios), con \n entre líneas', () => {
    const txt = contenidoAdsTxt('# panel\nadsterra.com, 12345, DIRECT, abcdef0123456789\n<script>x</script>\nexample.com, 99, RESELLER')
    expect(txt).toBe('# panel\nadsterra.com, 12345, DIRECT, abcdef0123456789\nexample.com, 99, RESELLER\n')
  })
  it('acepta el salto de línea escrito como texto (una o dos barras) y no deja pasar basura dentro de un comentario', () => {
    expect(contenidoAdsTxt(String.raw`# panel\nadsterra.com, 1, DIRECT`)).toBe('# panel\nadsterra.com, 1, DIRECT\n')
    expect(contenidoAdsTxt(String.raw`# panel\\nadsterra.com, 1, DIRECT`)).toBe('# panel\nadsterra.com, 1, DIRECT\n')
    expect(contenidoAdsTxt(String.raw`# comentario con \x raro`)).toBeNull()
  })
  it('sin nada válido no hay ads.txt', () => {
    for (const v of [undefined, '', '   ', 'basura\nmás basura']) expect(contenidoAdsTxt(v)).toBeNull()
  })
})
