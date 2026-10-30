// Helpers puros de los pines del globo: codificacion por canal (P1), estado de interaccion y
// formato del badge de delta. Sin React ni three.js — todo testeable con vitest
// (pin-estados.test.ts), siguiendo el patron de geo.ts/geo.test.ts.

import type { TipoMarcador } from './marcadores'

// =================================================================================================
// P1 — TABLA DE CANALES. Un canal, un significado.
//
// El sistema anterior (F1) sobrecargaba el color hasta hacerlo ilegible: #f7b955 era A LA VEZ
// TIPO (energia, en colorNucleo), ESTADO (seleccionado, en colorHalo) y DIRECCION (delta
// positivo, en colorDelta); y #4fc3ff era a la vez ESTADO (hover) y DIRECCION (delta negativo),
// con #7fd4ff haciendo de reposo y de delta plano. Un pin de plata, seleccionado y subiendo
// pintaba cuerpo plateado + halo ambar + texto ambar: dos ambares distintos en el mismo pin y
// ninguna forma de saber cual significaba que. Encima el anillo HUD del delta
// (GloboHolografico.tsx, COLOR_DELTA_POSITIVO/NEGATIVO) ya habia pasado a verde/rojo semantico,
// asi que en el mismo viewport el mismo dato — la direccion — se pintaba con dos paletas.
//
//   CANAL                              SIGNIFICADO              VALORES
//   ---------------------------------- ------------------------ ------------------------------------
//   silueta del cuerpo                 TIPO                     disco (energia) | cuadrado (metal)
//   color del cuerpo                   TIPO (redundante)        #f7b955 | #d7b6ff
//   anatomia del cuerpo                — (constante, no canal)  foso oscuro + aro + punto
//   reticula: presencia/escala/cierre  ESTADO                   ver escalaReticula / opacidadReticula
//                                                               / cierreReticula
//   tinta de la reticula               — (cromo fijo, no canal) #4fc3ff en los tres estados
//   color del texto del badge          DIRECCION                #22c55e | #ff3b30 | #999999
//   simbolo del badge                  DIRECCION (redundante)   flecha arriba | abajo | raya
//   presencia del badge                — (divulgacion, no canal) nada en reposo, ±% con atencion
//
// Las dos redundancias son deliberadas, no descuido: forma+color sirve a daltonicos y al tamaño
// real del pin (el cuerpo mide ~12px a la camara del hero en desktop, ~8px en movil), y
// simbolo+color cumple WCAG 1.4.1 — el color no puede ser el unico portador de la direccion.
//
// La regla que hace falta no romper: ningun valor de esta tabla puede aparecer en dos filas de
// significados distintos. pin-estados.test.ts lo afirma con un test de disyuncion, y afirma
// tambien que el modulo NO exporta ninguna funcion de color que reciba un EstadoPin — porque es
// justo eso (colorHalo) lo que creo el desastre anterior.
// =================================================================================================

// THREE.Color no lee variables CSS: hex local con el token al lado (mismo patron que
// GloboHolografico.tsx y NodosSesion.tsx) para que el mapa hex -> token quede explicito.

// --- Canal TIPO -----------------------------------------------------------------------------
// Veredicto F0-11/R2, intacto: este ambar NO se colapsa a --semantic-warning (que en todo el
// repo significa precaucion: banners de error, ticker rancio, aviso de borrador — un pin de
// energia no es una advertencia) y no cuelga de --brand-amber, que es marca. P1 solo le cambia
// el NOMBRE: se llamaba COLOR_AMBAR, un nombre de tono, y mientras se llamo asi fue facil
// reutilizarlo "porque es el ambar" en otros dos canales. Ahora se llama por su significado.
export const COLOR_ENERGIA = '#f7b955' // --globe-energia — TIPO: energia
// P3 — el metal deja de ser #d8e3f0 (casi blanco) y pasa a un violeta claro. Esto NO es gusto:
// es la unica correccion posible de un problema de figura-fondo medido.
//
// El continente son ~36.000 puntos de #7fd4ff (--accent-cyan-soft, L=0.588). Contra ese fondo:
//   · por LUMINANCIA no hay escapatoria para ninguna tinta clara. #d8e3f0 da 1.27:1 contra un
//     punto de tierra y el techo absoluto — blanco puro — se queda en 1.65:1, por debajo del 3:1
//     que WCAG 1.4.11 pide a un indicador no textual. O sea que ningun color claro se separa del
//     mapa por brillo, y por eso el foso oscuro del cuerpo (PinesActivos.tsx) es obligatorio y no
//     decorativo.
//   · por TONO si, y ahi es donde #d8e3f0 fallaba: su matiz es 213 grados, a 12 grados del cian
//     del mapa. Un gris-azulado clarisimo sobre una trama cian brillante no es una figura, es un
//     claro de la misma trama — que es literalmente lo que se veia en la captura.
//
// #d7b6ff esta a 67 grados del cian de los puntos y de la reticula, a 130 del ambar de energia,
// a 125 del verde y a 96 del rojo de direccion: es el hueco de matiz mas ancho que queda libre en
// el viewport, y por tanto el unico sitio donde el metal puede vivir sin pisar otro canal.
//
// El valor concreto esta ELEGIDO para que su luminancia cuadre con la del ambar: 11.35:1 sobre
// --globe-base los dos, al mismo alpha. Esa es la razon de que P3 pueda borrar alphaTintaCuerpo
// (la correccion de peso que P2 necesitaba porque #d8e3f0 pesaba un 34% mas que #f7b955): ya no
// hay nada que corregir, los dos tipos pesan igual por construccion. Si alguien mueve uno de los
// dos hex, pin-estados.test.ts recalcula los contrastes y dice el numero que se ha roto.
//
// El color sigue codificando TIPO y no el metal concreto: oro y plata comparten cuerpo y se
// distinguen por su etiqueta sr-only y por su badge.
export const COLOR_METAL = '#d7b6ff' // TIPO: metal
// Futuros de indices (PLAN-FUTUROS.md D6): rosa claro, el OTRO hueco de matiz libre del viewport.
// Matiz ~315 grados: a 47 del violeta del metal, a 77 del ambar, a 114 del cian del mapa y de la
// reticula, a 172 del verde y a 49 del rojo de direccion — todos por encima del minimo de 45 que
// vigila pin-estados.test.ts. Se descartaron el verde (se lee como "sube", canal DIRECCION) y
// cualquier cian/teal (se funde con el mapa). La luminancia esta ELEGIDA a la par de la del ambar
// (11.3:1 sobre --globe-base, mismo peso que energia y metal): sin token propio, como el metal.
export const COLOR_INDICE = '#fca9e8' // TIPO: futuros de indices

// --- Cromo del canal ESTADO ------------------------------------------------------------------
// P1 — la reticula tiene UNA tinta y no se mueve nunca. El estado se lee por presencia, escala y
// cierre (abajo), no por tono: eso es lo que libera al ambar de significar "seleccionado".
// --accent-cyan es exactamente el token de "acento interactivo: borde, foco, hover", asi que la
// reticula es su uso natural; y queda libre porque colorDelta ya no lo usa para el delta
// negativo. Mide 9.7:1 sobre --globe-base a opacidad plena y 6.2:1 a la del estado resaltado
// (0.6), por encima del 3:1 que WCAG 1.4.11 pide a un indicador no textual.
export const COLOR_RETICULA = '#4fc3ff' // --accent-cyan — cromo de ESTADO

// --- Canal DIRECCION -------------------------------------------------------------------------
// P1 — los MISMOS valores que COLOR_DELTA_POSITIVO/COLOR_DELTA_NEGATIVO del anillo HUD de
// GloboHolografico.tsx. No son "otro verde parecido": si alguien mueve uno de los dos sitios,
// el viewport vuelve a contar la misma direccion con dos paletas, que es el bug que P1 cierra.
export const COLOR_SUBE = '#22c55e' // --semantic-success — DIRECCION: delta positivo
export const COLOR_BAJA = '#ff3b30' // --semantic-danger — DIRECCION: delta negativo
// Plano (delta exactamente 0) es gris neutro a proposito, y NO #7fd4ff como antes: ese cian
// suave se solapaba con el reposo del halo, y cualquier cian de la familia del globo se solapa
// hoy con la tinta de la reticula. "Sin direccion" se lee mejor en un tono que no pertenece a
// ningun otro canal. 6.7:1 sobre --globe-base, de sobra para texto de badge.
export const COLOR_PLANO = '#999999' // --ink-muted — DIRECCION: delta plano

// Silueta del cuerpo: el canal nuevo de P1. Antes los 8 pines eran el mismo icosaedro y la forma
// no codificaba nada. Disco y cuadrado son el par de siluetas mas separable a 8-12px (el
// cuadrado tiene esquinas, el disco no); se descarto el triangulo, que es la otra silueta muy
// separable, porque apunta — y "apuntar" ya significa direccion del delta en el badge (flecha
// arriba/abajo). Un cuerpo triangular habria reabierto exactamente el solape de canales que
// esta ronda cierra. Para el tercer tipo (futuros de indices) se usa el ROMBO: es el cuadrado
// girado 45 grados, tiene esquinas como el (se separa del disco) y es simetrico arriba/abajo, asi
// que no apunta a ningun lado. Se separa del cuadrado por orientacion y por tinta, no por tamaño.
export type SiluetaPin = 'disco' | 'cuadrado' | 'rombo'

// Estados del pin, en orden de atencion. Precedencia: seleccionado > resaltado > inactivo.
export type EstadoPin = 'inactivo' | 'resaltado' | 'seleccionado'

// Clasifica el estado a partir de las props de interaccion que ya reparte GloboHolografico
// (seleccionId/resaltadoId). Un pin seleccionado sigue resaltado si el raton se queda encima,
// pero la seleccion es la que manda: es el estado "caliente".
export function clasificarEstadoPin(seleccionado: boolean, resaltado: boolean): EstadoPin {
  if (seleccionado) return 'seleccionado'
  if (resaltado) return 'resaltado'
  return 'inactivo'
}

// Senal de vida: solo un cambio intradia real (distinto de 0 y finito) autoriza el latido del
// pin. Sin senal el idle queda estatico — el pulso infinito decorativo del anillo antiguo se
// elimino en F1 y no vuelve. P1 mueve el latido del halo (muerto) a la marca de contacto.
export function tieneSenalIntradia(cambio: number | null | undefined): boolean {
  return cambio != null && Number.isFinite(cambio) && cambio !== 0
}

// --- Canal TIPO: silueta + color (redundantes 1:1) -------------------------------------------
// Las dos funciones reciben SOLO el tipo. Que no acepten un EstadoPin es el contrato: el estado
// no puede tocar el cuerpo del pin.
export function siluetaCuerpo(tipo: TipoMarcador): SiluetaPin {
  if (tipo === 'energia') return 'disco'
  return tipo === 'metal' ? 'cuadrado' : 'rombo'
}

export function colorCuerpo(tipo: TipoMarcador): string {
  if (tipo === 'energia') return COLOR_ENERGIA
  return tipo === 'metal' ? COLOR_METAL : COLOR_INDICE
}

// P3 — aqui vivia alphaTintaCuerpo, el alpha con el que P2 rebajaba el metal para que el canal
// de TIPO no se leyera de paso como canal de importancia. Se elimina, y conviene saber por que
// para que nadie lo reponga: era un parche sobre un hex mal elegido. #d8e3f0 pesaba 15.26:1
// contra --globe-base y #f7b955 11.35:1, asi que habia que apagar el metal un 17% para igualarlos.
// #d7b6ff pesa 11.35:1 — exactamente lo mismo que el ambar — asi que la correccion vale 1.0 en
// los dos tipos y una funcion que siempre devuelve 1 es ruido, no contrato. La paridad sigue
// vigilada: pin-estados.test.ts la mide directamente sobre los dos hex, sin alpha de por medio.

// --- Canal ESTADO: la reticula ---------------------------------------------------------------
// Tres estados, tres numeros por estado, cero cambios de color. El idioma es el de una terminal
// que fija el objetivo: la reticula APARECE y se CIERRA sobre el pin, no lo ilumina.
//
// Factor de escala sobre TAM_RETICULA (PinesActivos.tsx). Baja con la atencion a proposito —
// esto es lo contrario de lo que hacia el halo, que crecia. Un corchete que se estrecha sobre el
// objetivo es "fijado"; uno que se expande es "explosion".
//   inactivo     1.50 — invisible (presencia 0), pero es el reposo del amortiguador: el hover
//                       entra cerrandose de 1.50 a 1.30 en vez de aparecer ya puesto, y al salir
//                       se abre otra vez por el mismo camino (simetria de entrada/salida).
//   resaltado    1.30 — ~21px de marco alrededor de un cuerpo de ~12px: ~4px de aire por lado.
//   seleccionado 1.04 — ~17px: ~2px de aire. Pegada al cuerpo = "este es el abierto".
export function escalaReticula(estado: EstadoPin): number {
  switch (estado) {
    case 'seleccionado':
      return 1.04
    case 'resaltado':
      return 1.3
    default:
      return 1.5
  }
}

// Presencia. En reposo es 0 de verdad, no "tenue": ocho reticulas permanentes sobre el globo son
// ruido, y si el reposo ya tiene cromo de estado el hover no tiene nada que anunciar. El cuerpo
// solo (tipo) es el reposo correcto.
export function opacidadReticula(estado: EstadoPin): number {
  switch (estado) {
    case 'seleccionado':
      return 1
    case 'resaltado':
      return 0.6
    default:
      return 0
  }
}

// Cierre: cuanto se alargan los brazos de los cuatro corchetes. 0 = corchetes cortos (brazo 22%
// del lado, hueco del 56% en cada lado del marco); 1 = brazos extendidos hasta el 44% del lado,
// con solo un 12% de hueco — el marco casi se cierra sin llegar a ser una caja. En PinesActivos
// esto es la opacidad de la textura de extension, que dibuja SOLO el tramo nuevo del brazo
// (del 25% al 44%) y por eso no se solapa con la base: el brazo crece, no se duplica.
export function cierreReticula(estado: EstadoPin): number {
  return estado === 'seleccionado' ? 1 : 0
}

// --- Canal DIRECCION: el badge ---------------------------------------------------------------
// P3/P4 — el badge imprime el ±% completo y lo imprime UNA sola vez en toda la escena: en el pin
// que tiene la atencion (hover, o seleccion si no hay hover). Los otros siete no llevan etiqueta.
// Eso es toda la divulgacion progresiva que hay; no queda un nivel intermedio.
//
// El motivo es aritmetica, no gusto: la cuerda entre WTI y gasLuisiana son 0.1246 unidades de
// mundo (~24.7px a la camara del hero) y la placa del ±% mide ~43px de ancho, asi que con los
// ocho numeros puestos el solape es inevitable — en la captura era un amasijo rojo y verde
// ilegible sobre Centroamerica. P3 probo un nivel compacto (un chip con solo el glifo ▲▼–) para
// los siete pines sin atencion y tambien se descarto, por geometria y no por estetica: no existe
// un desplazamiento que libre a la vez el cuerpo del propio pin y el del vecino (la medicion
// completa esta en duenoBadge, PinesActivos.tsx). Por eso aqui no hay helper de glifo ni de
// direccion suelta — habria quedado huerfano, y pin-estados.test.ts vigila que no reaparezca.
//
// Sin atencion, lo que cuenta un pin es su TIPO (silueta + tinta del cuerpo) y si tiene senal
// intradia viva (el latido del ancla, ver tieneSenalIntradia). El signo exacto es un dato que se
// pide, y pedirlo es apuntar al pin.

// Texto del badge live: dos decimales como la tarjeta (TarjetaActivo.tsx) y flecha de direccion.
// La flecha se queda SIEMPRE (WCAG 1.4.1): el color del texto es refuerzo, no el unico canal —
// quitada la flecha, un usuario con deuteranopia se queda sin la direccion. Sin dato util no hay
// badge (null): nada de "0.00%" inventado cuando la cotizacion no existe.
export function formatearDelta(cambio: number | null | undefined): string | null {
  if (cambio == null || !Number.isFinite(cambio)) return null
  const valor = Math.abs(cambio).toFixed(2)
  if (cambio > 0) return `▲${valor}%`
  if (cambio < 0) return `▼${valor}%`
  return `${valor}%`
}

// Tinta del badge: verde sube, rojo baja, gris plano — los tokens semanticos del repo, los
// mismos que el anillo HUD del delta. Antes esto devolvia ambar/cian/cian-suave, es decir la
// paleta de TIPO y de ESTADO, y era la tercera pata del solape que P1 desmonta.
export function colorDelta(cambio: number | null | undefined): string | null {
  if (cambio == null || !Number.isFinite(cambio)) return null
  if (cambio > 0) return COLOR_SUBE
  if (cambio < 0) return COLOR_BAJA
  return COLOR_PLANO
}
