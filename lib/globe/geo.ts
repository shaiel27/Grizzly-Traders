// Unica fuente de verdad para convertir lat/lon (radianes) a una posicion 3D sobre el globo.
// Usada por el muestreo de continentes, los pines de activos y los nodos de sesion — si cada
// uno tuviera su propia formula, un desajuste entre ellas pondria un pin en el oceano aunque
// el continente de abajo este bien ubicado.

export interface Vector3Like {
  x: number
  y: number
  z: number
}

/**
 * lat/lon en radianes (lat: -PI/2..PI/2, lon: -PI..PI, positivo = este).
 *
 * El signo de z es el que importa: useArrastreGlobo.ts define rotY positivo (el auto-giro,
 * "oeste a este") como el giro que mueve un punto que mira a camara hacia +X (derecha en
 * pantalla) — ver qY.setFromAxisAngle(UP, rotY) en GloboHolografico.tsx. Para que la longitud
 * geografica coincida con ese sentido (este = mismo sentido que rotY positivo), hace falta
 * z = -cos(lat)*sin(lon). Con z = +cos(lat)*sin(lon) (como estaba antes en
 * muestrearTierra.ts) el mapa queda espejado este<->oeste: el auto-giro "hacia el este" en
 * realidad revela territorio al oeste, y un pin en Venezuela terminaria del lado del Pacifico.
 */
export function latLonAVector3(lat: number, lon: number, radio = 1): Vector3Like {
  const cosLat = Math.cos(lat)
  return {
    x: radio * cosLat * Math.cos(lon),
    y: radio * Math.sin(lat),
    z: -radio * cosLat * Math.sin(lon),
  }
}

export function gradosARadianes(grados: number): number {
  return (grados * Math.PI) / 180
}
