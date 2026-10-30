import { describe, expect, it } from 'vitest'
import * as pinEstados from './pin-estados'
import {
  COLOR_BAJA,
  COLOR_ENERGIA,
  COLOR_INDICE,
  COLOR_METAL,
  COLOR_PLANO,
  COLOR_RETICULA,
  COLOR_SUBE,
  cierreReticula,
  clasificarEstadoPin,
  colorCuerpo,
  colorDelta,
  escalaReticula,
  formatearDelta,
  opacidadReticula,
  siluetaCuerpo,
  tieneSenalIntradia,
  type EstadoPin,
} from './pin-estados'

// Esta suite describe el sistema de canales de P1, no el anterior. Los 20 tests de F1 afirmaban
// el contrato viejo (halo que tiñe el estado, delta en ambar/cian) y ese contrato ya no existe:
// se reescribieron, no se borraron para pasar. Lo nuevo que vigilan y antes no: que ningun valor
// de color sirva a dos canales, que el modulo no tenga NINGUNA funcion de color que reciba un
// estado, y que la direccion del delta use los tokens del anillo HUD.

const TIPOS = ['energia', 'metal', 'indice'] as const
const ESTADOS: readonly EstadoPin[] = ['inactivo', 'resaltado', 'seleccionado']

describe('clasificarEstadoPin', () => {
  it('la seleccion manda sobre el resaltado (el raton puede seguir encima mientras esta abierto)', () => {
    expect(clasificarEstadoPin(true, true)).toBe('seleccionado')
    expect(clasificarEstadoPin(true, false)).toBe('seleccionado')
  })

  it('resaltado sin seleccion es el estado hover', () => {
    expect(clasificarEstadoPin(false, true)).toBe('resaltado')
  })

  it('sin seleccion ni hover el pin queda inactivo (reposo)', () => {
    expect(clasificarEstadoPin(false, false)).toBe('inactivo')
  })
})

describe('tieneSenalIntradia', () => {
  // Regla F1, vigente en P1: el latido del pin solo puede existir si hay senal real (cambio
  // intradia). Un pin idle SIN cotizacion o con cambio 0 se queda estatico.
  it('sin cambio (null/undefined) no hay senal', () => {
    expect(tieneSenalIntradia(null)).toBe(false)
    expect(tieneSenalIntradia(undefined)).toBe(false)
  })

  it('un cambio exactamente 0 no es senal: no hay movimiento que señalar', () => {
    expect(tieneSenalIntradia(0)).toBe(false)
  })

  it('cualquier cambio distinto de 0 si es senal', () => {
    expect(tieneSenalIntradia(0.42)).toBe(true)
    expect(tieneSenalIntradia(-1.2)).toBe(true)
    expect(tieneSenalIntradia(0.01)).toBe(true)
  })

  it('valores no finitos (NaN, infinito) se ignoran como sin senal', () => {
    expect(tieneSenalIntradia(NaN)).toBe(false)
    expect(tieneSenalIntradia(Infinity)).toBe(false)
  })
})

describe('P1 — un canal, un significado', () => {
  // El bug que cierra esta ronda: #f7b955 era TIPO + ESTADO + DIRECCION a la vez, y #4fc3ff era
  // ESTADO + DIRECCION. Estos tests son la red que impide que vuelva a pasar.
  it('los hex son exactamente los tokens de globals.css', () => {
    expect(COLOR_ENERGIA).toBe('#f7b955') // --globe-energia
    expect(COLOR_METAL).toBe('#d7b6ff') // P3: violeta claro, sin token propio (ver abajo el por que)
    expect(COLOR_RETICULA).toBe('#4fc3ff') // --accent-cyan
    expect(COLOR_SUBE).toBe('#22c55e') // --semantic-success
    expect(COLOR_BAJA).toBe('#ff3b30') // --semantic-danger
    expect(COLOR_PLANO).toBe('#999999') // --ink-muted
  })

  it('ningun valor de color sirve a dos canales a la vez', () => {
    const porCanal = {
      tipoEnergia: COLOR_ENERGIA,
      tipoMetal: COLOR_METAL,
      tipoIndice: COLOR_INDICE,
      estadoReticula: COLOR_RETICULA,
      direccionSube: COLOR_SUBE,
      direccionBaja: COLOR_BAJA,
      direccionPlano: COLOR_PLANO,
    }
    const valores = Object.values(porCanal)
    expect(new Set(valores).size).toBe(valores.length)
  })

  it('la direccion del delta usa los MISMOS tokens que el anillo HUD, no la paleta de tipo ni de estado', () => {
    // Literales a proposito: son los valores de COLOR_DELTA_POSITIVO/COLOR_DELTA_NEGATIVO de
    // GloboHolografico.tsx. Si alguien mueve uno de los dos sitios, el mismo viewport vuelve a
    // contar la direccion con dos paletas distintas y este test cae.
    expect(colorDelta(1)).toBe('#22c55e')
    expect(colorDelta(-1)).toBe('#ff3b30')
    for (const cambio of [3.5, -3.5, 0, 0.001, -0.001]) {
      expect([COLOR_ENERGIA, COLOR_METAL, COLOR_RETICULA]).not.toContain(colorDelta(cambio))
    }
  })

  it('el cuerpo nunca se pinta con un color de direccion ni con el cromo de la reticula', () => {
    for (const tipo of TIPOS) {
      expect([COLOR_SUBE, COLOR_BAJA, COLOR_PLANO, COLOR_RETICULA]).not.toContain(colorCuerpo(tipo))
    }
  })
})

describe('canal TIPO: silueta + color', () => {
  it('silueta por tipo: energia disco, metal cuadrado, indice rombo', () => {
    expect(siluetaCuerpo('energia')).toBe('disco')
    expect(siluetaCuerpo('metal')).toBe('cuadrado')
    expect(siluetaCuerpo('indice')).toBe('rombo')
  })

  it('color por tipo: energia en el ambar de datos del globo, metal en el violeta claro', () => {
    expect(colorCuerpo('energia')).toBe('#f7b955')
    expect(colorCuerpo('metal')).toBe('#d7b6ff')
    expect(colorCuerpo('indice')).toBe('#fca9e8')
  })

  it('silueta y color son redundantes 1:1 (daltonismo y tamaño pequeño)', () => {
    // Si alguien añade un tipo nuevo con silueta propia pero reusando un color, o al contrario,
    // la redundancia deja de serlo y uno de los dos canales miente.
    const pares = TIPOS.map((t) => `${siluetaCuerpo(t)}|${colorCuerpo(t)}`)
    expect(new Set(pares).size).toBe(pares.length)
    expect(new Set(TIPOS.map(siluetaCuerpo)).size).toBe(TIPOS.length)
    expect(new Set(TIPOS.map(colorCuerpo)).size).toBe(TIPOS.length)
  })

  it('el canal de tipo no depende del estado: silueta y color solo reciben el tipo', () => {
    expect(siluetaCuerpo.length).toBe(1)
    expect(colorCuerpo.length).toBe(1)
  })
})

describe('P3 — figura-fondo: el cuerpo del pin contra los puntos de tierra', () => {
  // WCAG 2.x relative luminance + contraste, para poder afirmar POR QUE cada hex y cada banda
  // valen lo que valen en vez de darlos por buenos. Si alguien mueve COLOR_METAL o COLOR_ENERGIA,
  // estos tests dicen el numero exacto que se ha roto.
  const canales = (hex: string): readonly number[] =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const luminancia = (rgb: readonly number[]): number => {
    const [r, g, b] = rgb.map((c) => {
      const n = c / 255
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contraste = (a: readonly number[], b: readonly number[]): number => {
    const [x, y] = [luminancia(a) + 0.05, luminancia(b) + 0.05]
    return x > y ? x / y : y / x
  }
  // El canvas compone en espacio gamma, asi que esto es la misma cuenta que hace crearTexturaCuerpo.
  const sobre = (frente: readonly number[], fondo: readonly number[], alpha: number): readonly number[] =>
    frente.map((c, i) => alpha * c + (1 - alpha) * fondo[i])

  // Matiz HSV en grados y distancia angular entre matices: el canal que SI puede separar un
  // marcador de un mapa cian, ya que la luminancia no puede (ver el test del foso).
  const matiz = (rgb: readonly number[]): number => {
    const [r, g, b] = rgb.map((c) => c / 255)
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const d = mx - mn
    if (d === 0) return 0
    let h: number
    if (mx === r) h = ((g - b) / d) % 6
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    return (h * 60 + 360) % 360
  }
  const distanciaMatiz = (a: number, b: number): number => {
    const d = Math.abs(a - b) % 360
    return Math.min(d, 360 - d)
  }

  const GLOBE_BASE = canales('#020a18')
  const TIERRA = canales('#7fd4ff') // --accent-cyan-soft: los ~36k puntos del continente
  const ALFA_RELLENO = 0.32 // PinesActivos.tsx: tono 2 de la anatomia (P4 lo subio de 0.22)
  // Reproduce los tonos de tinta del cuerpo tal como los apila el canvas (el foso acaba en
  // --globe-base al 0.95, asi que de cara al contraste el suelo es --globe-base).
  const anatomia = (tipo: (typeof TIPOS)[number]) => {
    const tinta = canales(colorCuerpo(tipo))
    const relleno = sobre(tinta, GLOBE_BASE, ALFA_RELLENO)
    return { relleno, aro: sobre(tinta, relleno, 1) }
  }

  it('los dos tipos pesan lo mismo sin que haga falta corregir ningun alpha', () => {
    // Esta es la razon de que P3 pudiera borrar alphaTintaCuerpo: #d7b6ff esta ELEGIDO para que su
    // luminancia cuadre con la de #f7b955, asi que la paridad sale del hex y no de un parche.
    // Tolerancia 2%: el canal de TIPO no puede leerse de paso como canal de importancia.
    const parejos = (a: number, b: number) => expect(Math.abs(a - b) / a).toBeLessThan(0.02)
    parejos(luminancia(canales(COLOR_ENERGIA)), luminancia(canales(COLOR_METAL)))
    const e = anatomia('energia')
    const m = anatomia('metal')
    parejos(contraste(e.aro, GLOBE_BASE), contraste(m.aro, GLOBE_BASE)) // ~11.35 los dos
    parejos(contraste(e.relleno, GLOBE_BASE), contraste(m.relleno, GLOBE_BASE)) // ~2.04 / ~2.07
    parejos(contraste(e.aro, e.relleno), contraste(m.aro, m.relleno)) // ~5.57 / ~5.48
    // El rombo de futuros de indices entra en la misma paridad: es un tercer tipo, no una excepcion.
    const i = anatomia('indice')
    parejos(luminancia(canales(COLOR_ENERGIA)), luminancia(canales(COLOR_INDICE)))
    parejos(contraste(e.aro, GLOBE_BASE), contraste(i.aro, GLOBE_BASE))
    parejos(contraste(e.relleno, GLOBE_BASE), contraste(i.relleno, GLOBE_BASE))
    parejos(contraste(e.aro, e.relleno), contraste(i.aro, i.relleno))
    expect(contraste(i.aro, GLOBE_BASE)).toBeGreaterThan(4.5)
    // Y el aro sigue siendo el portador de contraste del cuerpo, no el relleno.
    expect(contraste(e.aro, GLOBE_BASE)).toBeGreaterThan(4.5)
    expect(contraste(m.aro, GLOBE_BASE)).toBeGreaterThan(4.5)
  })

  it('la correccion de peso por alpha no vuelve: ya no hay nada que corregir', () => {
    // alphaTintaCuerpo era un parche sobre un hex mal elegido. Si reaparece es que alguien ha
    // vuelto a meter un color de TIPO que no pesa lo que debe, y el sitio de arreglarlo es el hex.
    expect(Object.keys(pinEstados).filter((n) => n.toLowerCase().includes('alpha'))).toEqual([])
  })

  it('ninguna tinta clara se separa de los puntos de tierra por luminancia: el foso es obligatorio', () => {
    // Medicion que justifica las tres bandas oscuras de crearTexturaCuerpo. El aro de los dos
    // tipos esta a ~1:1 de un punto de tierra — y no es culpa de estos dos hex: el techo
    // absoluto, blanco puro sobre ese cian, se queda en 1.65:1, muy por debajo del 3:1 que WCAG
    // 1.4.11 pide a un indicador no textual. Mientras esto sea asi, quitar el foso devuelve el
    // pin al mapa y el marcador desaparece.
    for (const tipo of TIPOS) {
      expect(contraste(anatomia(tipo).aro, TIERRA)).toBeLessThan(1.3)
    }
    expect(contraste(canales('#ffffff'), TIERRA)).toBeLessThan(3)
    // Lo que SI separa: el escalon del suelo del foso contra un punto de tierra.
    expect(contraste(GLOBE_BASE, TIERRA)).toBeGreaterThan(10)
  })

  it('cada tinta de TIPO esta lejos en MATIZ del cian del mapa: es el unico canal que queda', () => {
    // El test que habria cazado el bug que motivo P3. #d8e3f0 estaba a 12 grados del cian de los
    // puntos: un gris azulado clarisimo sobre una trama cian brillante no es una figura, es un
    // claro de la misma trama. 45 grados es el minimo para que la tinta se lea como otro color y
    // no como el mismo mas claro.
    const matizTierra = matiz(TIERRA)
    expect(distanciaMatiz(matiz(canales('#d8e3f0')), matizTierra)).toBeLessThan(45) // el hex viejo
    for (const tipo of TIPOS) {
      expect(distanciaMatiz(matiz(canales(colorCuerpo(tipo))), matizTierra)).toBeGreaterThanOrEqual(45)
    }
    // Y tampoco pueden acercarse entre si ni a la direccion: el matiz tambien es un canal.
    const otros = [COLOR_ENERGIA, COLOR_RETICULA, COLOR_SUBE, COLOR_BAJA]
    for (const otro of otros) {
      expect(distanciaMatiz(matiz(canales(COLOR_METAL)), matiz(canales(otro)))).toBeGreaterThan(45)
    }
    // El rosa de indices ocupa el otro hueco de matiz libre (~315 grados, entre el violeta del
    // metal y el rojo de direccion): ninguna otra tinta de tipo, de estado ni de direccion.
    for (const otro of [COLOR_ENERGIA, COLOR_METAL, COLOR_RETICULA, COLOR_SUBE, COLOR_BAJA]) {
      expect(distanciaMatiz(matiz(canales(COLOR_INDICE)), matiz(canales(otro)))).toBeGreaterThan(45)
    }
  })
})

describe('canal ESTADO: la reticula (presencia, escala, cierre)', () => {
  it('en reposo la reticula no existe: presencia 0', () => {
    // Deliberado, no un descuido heredado del halo (que en reposo estaba a 0.22): ocho reticulas
    // permanentes son ruido, y si el reposo ya lleva cromo de estado el hover no anuncia nada.
    expect(opacidadReticula('inactivo')).toBe(0)
    expect(cierreReticula('inactivo')).toBe(0)
  })

  it('la reticula se CIERRA sobre el objetivo: la escala baja con la atencion', () => {
    // Lo contrario del halo, que crecia. Un corchete que se estrecha es "fijado"; uno que se
    // expande es "explosion".
    expect(escalaReticula('resaltado')).toBeLessThan(escalaReticula('inactivo'))
    expect(escalaReticula('seleccionado')).toBeLessThan(escalaReticula('resaltado'))
    expect(escalaReticula('inactivo')).toBe(1.5)
    expect(escalaReticula('resaltado')).toBe(1.3)
    expect(escalaReticula('seleccionado')).toBe(1.04)
  })

  it('la presencia crece con la atencion y llega a opaca en seleccion', () => {
    expect(opacidadReticula('resaltado')).toBeGreaterThan(opacidadReticula('inactivo'))
    expect(opacidadReticula('seleccionado')).toBeGreaterThan(opacidadReticula('resaltado'))
    expect(opacidadReticula('resaltado')).toBe(0.6)
    expect(opacidadReticula('seleccionado')).toBe(1)
  })

  it('los brazos solo se alargan en seleccion: el cierre distingue abierto de resaltado', () => {
    expect(cierreReticula('resaltado')).toBe(0)
    expect(cierreReticula('seleccionado')).toBe(1)
  })

  it('cada estado es distinguible de los otros dos por su terna de numeros', () => {
    const ternas = ESTADOS.map((e) => `${escalaReticula(e)}|${opacidadReticula(e)}|${cierreReticula(e)}`)
    expect(new Set(ternas).size).toBe(ESTADOS.length)
  })

  it('el estado no tiñe nada: las funciones de estado solo devuelven numeros', () => {
    for (const estado of ESTADOS) {
      expect(typeof escalaReticula(estado)).toBe('number')
      expect(typeof opacidadReticula(estado)).toBe('number')
      expect(typeof cierreReticula(estado)).toBe('number')
      expect(opacidadReticula(estado)).toBeGreaterThanOrEqual(0)
      expect(opacidadReticula(estado)).toBeLessThanOrEqual(1)
    }
  })

  it('el modulo no exporta NINGUNA funcion de color que reciba un estado', () => {
    // colorHalo(estado) era el origen del solape: mientras exista una funcion que convierta
    // ESTADO en color, el ambar vuelve a significar "seleccionado". Solo pueden quedar dos:
    // una para TIPO y una para DIRECCION.
    const funcionesDeColor = Object.keys(pinEstados)
      .filter((nombre) => nombre.startsWith('color'))
      .sort()
    expect(funcionesDeColor).toEqual(['colorCuerpo', 'colorDelta'])
  })
})

describe('canal DIRECCION: el badge', () => {
  it('sin cotizacion util no hay badge', () => {
    expect(formatearDelta(null)).toBe(null)
    expect(formatearDelta(undefined)).toBe(null)
    expect(formatearDelta(NaN)).toBe(null)
    expect(formatearDelta(Infinity)).toBe(null)
  })

  it('positivo: flecha arriba y dos decimales (mismo formato que la tarjeta)', () => {
    expect(formatearDelta(1.234)).toBe('▲1.23%')
    expect(formatearDelta(0.05)).toBe('▲0.05%')
    expect(formatearDelta(12.34)).toBe('▲12.34%')
  })

  it('negativo: flecha abajo sobre el valor absoluto', () => {
    expect(formatearDelta(-0.5)).toBe('▼0.50%')
    expect(formatearDelta(-12.34)).toBe('▼12.34%')
  })

  it('plano (0): sin flecha, no hay direccion que señalar', () => {
    expect(formatearDelta(0)).toBe('0.00%')
  })

  it('la direccion sobrevive sin color (WCAG 1.4.1): la flecha la lleva el texto', () => {
    // El verde/rojo es refuerzo. Quitado el color, sube y baja siguen siendo distinguibles.
    expect(formatearDelta(2)?.startsWith('▲')).toBe(true)
    expect(formatearDelta(-2)?.startsWith('▼')).toBe(true)
    expect(formatearDelta(2)).not.toBe(formatearDelta(-2))
  })

  it('tinta del badge: verde sube, rojo baja, gris neutro el plano', () => {
    expect(colorDelta(1)).toBe(COLOR_SUBE)
    expect(colorDelta(-1)).toBe(COLOR_BAJA)
    expect(colorDelta(0)).toBe(COLOR_PLANO)
  })

  it('sin dato, sin color (el badge no se pinta)', () => {
    expect(colorDelta(null)).toBe(null)
    expect(colorDelta(undefined)).toBe(null)
    expect(colorDelta(NaN)).toBe(null)
    expect(colorDelta(Infinity)).toBe(null)
  })
})

describe('P4 — el chip de reposo no vuelve', () => {
  it('el modulo no exporta helpers de glifo ni de direccion suelta', () => {
    // Misma tecnica de introspeccion que el guardia de alphaTintaCuerpo, y por el mismo motivo:
    // P3 construyo direccionDelta/glifoDireccion para un chip compacto en los siete pines sin
    // atencion, y el chip se cayo por geometria — necesitaba un desplazamiento >= 0.0734 para
    // librar su propio cuerpo y <= 0.040 para no pisar al vecino, o sea que no existe. Con el
    // chip muerto esos dos helpers no tenian ni un solo llamante en la app: solo los sostenian
    // sus propios tests. Si reaparecen es que alguien esta reintentando el chip, y el sitio de
    // leer por que no cabe es el comentario del canal DIRECCION en pin-estados.ts.
    expect(Object.keys(pinEstados).filter((n) => /glifo|direccion/i.test(n))).toEqual([])
  })

  it('el unico badge es el ±% completo, y la flecha va dentro del texto', () => {
    // Lo que queda de la divulgacion progresiva: no hay nivel intermedio que pueda contradecir
    // al completo, porque no hay nivel intermedio. La direccion vive entera en formatearDelta.
    for (const cambio of [3.5, 0.01, -3.5, -0.01]) {
      expect(formatearDelta(cambio)).toMatch(/^[▲▼]\d/)
    }
  })
})
