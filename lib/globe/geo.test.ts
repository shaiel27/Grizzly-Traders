import { describe, expect, it } from 'vitest'
import { latLonAVector3, gradosARadianes } from './geo'

describe('latLonAVector3', () => {
  it('ubica los polos en +-Y, independiente de la longitud', () => {
    const norte = latLonAVector3(Math.PI / 2, 1.23)
    const sur = latLonAVector3(-Math.PI / 2, -2.1)
    expect(norte.y).toBeCloseTo(1, 5)
    expect(norte.x).toBeCloseTo(0, 5)
    expect(norte.z).toBeCloseTo(0, 5)
    expect(sur.y).toBeCloseTo(-1, 5)
  })

  it('en el ecuador, lon=0 cae sobre +X', () => {
    const p = latLonAVector3(0, 0)
    expect(p.x).toBeCloseTo(1, 5)
    expect(p.z).toBeCloseTo(0, 5)
  })

  // El giro hacia el este tiene que coincidir con el sentido de rotY positivo
  // (useArrastreGlobo.ts: rotY positivo = auto-giro "oeste a este" = mueve un punto que mira a
  // camara hacia +X). La derivada de un punto bajo una rotacion positiva alrededor de Y, en
  // (x,z)=(x0,z0), es (dx/dtheta, dz/dtheta) = (z0, -x0) — ese es el "sentido correcto". Si
  // longitud creciente (este) se mueve en ese mismo sentido, la geografia y el auto-giro
  // apuntan para el mismo lado. Antes del fix (z = +cos(lat)*sin(lon)) este test fallaba: el
  // este geografico iba exactamente al reves del auto-giro.
  it('longitud creciente (este) gira en el mismo sentido que rotY positivo', () => {
    const delta = 1e-4
    for (const lon of [0, Math.PI / 4, -Math.PI / 3, (5 * Math.PI) / 6]) {
      const p0 = latLonAVector3(0, lon)
      const p1 = latLonAVector3(0, lon + delta)
      const tangenteLon = { x: (p1.x - p0.x) / delta, z: (p1.z - p0.z) / delta }
      const tangenteRotY = { x: p0.z, z: -p0.x }
      const dot = tangenteLon.x * tangenteRotY.x + tangenteLon.z * tangenteRotY.z
      expect(dot).toBeGreaterThan(0)
    }
  })

  it('un punto 10 grados mas al este, visto desde el punto que mira a camara, se desplaza hacia +X', () => {
    // "El meridiano L mira a camara" se simula rotando el globo (rotY = -L) hasta que el punto
    // de longitud L quede en z máximo (mundo). Ahí, el mismo punto en L+10° debe tener x > 0
    // en coordenadas de mundo — igual que describe el plan 009 §1.0.
    const L = Math.PI / 6 // 30°, un meridiano cualquiera
    const rotY = -Math.PI / 2 - L
    const rotar = (p: { x: number; z: number }) => ({
      x: p.x * Math.cos(rotY) + p.z * Math.sin(rotY),
      z: -p.x * Math.sin(rotY) + p.z * Math.cos(rotY),
    })

    const base = rotar(latLonAVector3(0, L))
    expect(base.z).toBeGreaterThan(0.99) // efectivamente mirando a camara

    const alEste = rotar(latLonAVector3(0, L + gradosARadianes(10)))
    expect(alEste.x).toBeGreaterThan(base.x)
  })
})
