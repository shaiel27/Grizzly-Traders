'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MARCADORES, type CotizacionPin, type Marcador } from '@/lib/globe/marcadores'
import { latLonAVector3, gradosARadianes } from '@/lib/globe/geo'
import {
  COLOR_RETICULA,
  cierreReticula,
  clasificarEstadoPin,
  colorCuerpo,
  colorDelta,
  escalaReticula,
  formatearDelta,
  opacidadReticula,
  siluetaCuerpo,
  tieneSenalIntradia,
  type SiluetaPin,
} from '@/lib/globe/pin-estados'

// P1 — rediseño del pin de "gema de videojuego" a "marcador de instrumento". Tres capas, una por
// canal, y ningun canal comparte valores con otro (la tabla completa vive en pin-estados.ts):
//   · cuerpo   = TIPO    → silueta billboard (disco energia | cuadrado metal | rombo futuros de
//                          indices) en el color del tipo. P2 le rehizo la ANATOMIA y P3 la vuelve a rehacer (foso oscuro
//                          de tres bandas + aro + punto, ver crearTexturaCuerpo) sin tocar ni el
//                          canal ni la tecnica.
//   · reticula = ESTADO  → cuatro corchetes que aparecen y se cierran sobre el cuerpo, tinta fija
//   · badge    = DATO    → ±% intradia con la DIRECCION en verde/rojo semantico + flecha. P3 lo
//                          reduce a UNO: el del pin que tiene la atencion (ver duenoBadge)
//   · ancla    = contacto → anillo en el plano tangente que amarra el pin a la superficie
//
// Lo que murio aqui y por que (que nadie lo resucite):
//   · El icosaedro + su copia en wireframe a escala 1.14. A la camara del hero (z=5.2, fov 42) el
//     cuerpo medido era ~6px en desktop y ~4px en movil: facetas y aristas a ese tamaño no son
//     lectura, son barro, y costaban dos mallas por pin para pintar una mancha.
//   · El halo. Su sprite tenia escala 1.0 EN UNIDADES DE MUNDO, o sea ~198px de gradiente difuso
//     por pin a la camara del hero — ocho de esos lavaban los puntos de tierra. Y sobre todo:
//     era el portador de ESTADO por tinte (reposo cian suave / hover cian / seleccion ambar), que
//     es justo el solape de canales que esta ronda desmonta. No se degrado a "presencia tenue":
//     con cuerpo solido + anillo de contacto ya hay presencia, mas nitida y mas barata, asi que
//     sobraba. Se fue con el: su textura de canvas, su sprite por pin y su pasada aditiva.
//   · El tallo `cylinderGeometry(0.0016, 0.0038, 0.026, 6)`. 0.0076 de diametro = ~1.5px en
//     desktop y <1px en movil: detalle invisible con coste de geometria. Lo sustituye la marca de
//     contacto (ANCLA, abajo), que ademas es lo unico del pin que vive en el plano tangente y por
//     tanto lo unico que se escora con el giro del globo — que es exactamente lo que hace leer el
//     pin como "pegado a la esfera" y no "flotando delante de ella".
//   · escalaNucleo (1 / 1.28 / 1.6). Era el unico estado que leia el cuerpo; ahora el estado vive
//     entero en la reticula y el cuerpo no se mueve. A 12px, un 6% de escala es 0.7px: coste sin
//     senal, y un cuerpo que cambia de tamaño vuelve a meter ESTADO dentro del canal de TIPO.

// Pop in de entrada por pin: se arranca desde escala 0.9 (nunca scale(0)) con fade — un pin
// que aparece de la nada se lee como un error, no como una entrada.
const DURACION_ENTRADA = 0.36 // s
// Stagger fijo de la coreografia F3 (F0-08): el primer pin arranca `entradaRetrasoMs` (1600,
// justo tras la ventana del ultimo anillo HUD) y cada pin siguiente suma 60ms — el patron
// "1600 + 60*indice" del plan, con el retraso base en la prop y el paso fijo aca.
const STAGGER_ENTRADA_MS = 60
// Destello (aproximacion de Pulse: un solo golpe de brillo en vez de repeticion) cuando el
// delta de la cotizacion cambia respecto al valor anterior.
const DURACION_FLASH = 0.5 // s

// --- Tamaños. Referencia de conversion: con camara z=5.2 y fov 42, a la profundidad de un pin
// de la cara vista (distancia ~4.2) el alto visible son ~3.22 unidades de mundo; sobre el lienzo
// cuadrado del hero (max(min(78vh,720px)) ~ 640px en desktop) eso da ~198px por unidad, y ~124px
// en el lienzo movil (~400px). Todos los px citados aqui son los de desktop; en movil valen el
// 63% y la proporcion respecto al globo es identica, porque el globo encoge con ellos.

// V3 (vigente) — tamaño del badge. Estaba en 0.048 (~11px de texto), es decir por debajo del 0.09
// que F0-01 ya descarto por ilegible en las etiquetas HUD y que subio a 0.16. Un dato numerico —
// el ±% del activo — no puede ir mas pequeño que una etiqueta que el equipo ya rechazo por no
// leerse. 0.062 deja el texto en ~14px a la distancia de camara del hero.
const ALTO_BADGE = 0.062
// P3 — lado del sprite del cuerpo: 0.094 -> 0.118 (~18.6px -> ~23.3px en desktop, ~11.7 ->
// ~14.6px en movil). El tamaño NO es la solucion al problema de figura-fondo (eso lo resuelve el
// foso de crearTexturaCuerpo) pero es su condicion: con el foso a 3.8px de banda, el aro a 2.4px
// y el punto a 3.6px (valores de P4), la caja de 0.094 no da para los tres. A 0.118 cada pieza
// cae por encima de 1px incluso en movil, que es el umbral por debajo del cual el mip se la come.
// El techo no es estetico, es de catalogo: la cuerda entre WTI y gasLuisiana son 0.1246 (~24.7px)
// y la silueta exterior mide 21.2px, asi que ese par queda con ~3.5px de hueco. Subir mas los
// solaparia. Sigue muy por debajo del objetivo de raycast (esfera de radio 0.07 contra un
// semilado visible de 0.0535), asi que el contrato de RADIO_HIT no se toca.
const TAM_CUERPO = 0.118
// P3 — lado del sprite de la reticula ANTES del factor de estado: 0.122 -> 0.128. NO es un
// rediseño del canal de ESTADO — los factores de escalaReticula (1.5 / 1.3 / 1.04) son contrato y
// siguen intactos. Es lo contrario: crece lo justo para que el aire alrededor del cuerpo nuevo
// siga siendo el que pin-estados.ts documenta ("~4px en hover, ~2px en seleccion"). Medido contra
// la placa dura del cuerpo (0.0848, que es el borde que se ve; las dos bandas de fuera son
// desvanecido): marco de hover 0.1298 -> 4.45px de aire, marco de seleccion 0.1038 -> 1.88px.
// En reposo 0.1920, invisible.
const TAM_RETICULA = 0.128
// Escala de reposo en el JSX para que el sprite no exista ni un frame a su escala por defecto
// (1 unidad de mundo = ~198px). useFrame la sobreescribe el mismo frame y la opacidad de reposo
// es 0, asi que es cinturon y tirantes — pero un sprite de 198px aunque sea invisible es el tipo
// de cosa que un futuro `visible` o un cambio de blending convierte en un fogonazo.
const ESCALA_RETICULA_REPOSO = TAM_RETICULA * escalaReticula('inactivo')
const Z_CUERPO = 0.045 // el cuerpo flota sobre la superficie: a esta altura no z-pelea con la esfera ni en el limbo
const Z_RETICULA = 0.044 // 0.001 (~0.2px) por detras del cuerpo: orden de pintado determinista sin tocar renderOrder
// P1 — marca de contacto: anillo en el plano tangente. Es mas pequeño que el cuerpo, asi que de
// frente queda tapado por el — y eso es correcto, no un defecto: de frente no hay nada que
// amarrar. Su trabajo es el angulo oblicuo y el limbo, donde se escora en elipse y deja ver los
// ~9px de separacion (Z_CUERPO) entre la superficie y el marcador.
//
// P4 — el ancla era la pieza mas floja del pin: ∅9px al 0.45 de opacidad, o sea una hairline de
// 1.6px que en captura no aparecia en ningun pin. El escorzo no se veia, y sin escorzo los ocho
// marcadores flotaban delante del globo en vez de estar clavados en el. Sube a ∅13.5px con 2.0px
// de grosor y opacidad 0.58.
// El techo esta medido y no es de gusto: el radio exterior tiene que quedarse DENTRO de la placa
// dura del cuerpo (semiextension 0.0424 = 8.4px) para que de frente siga tapado y no le añada
// un borde a la silueta — que es el canal de TIPO. 0.034 son 6.7px, o sea 1.7px de margen.
const RADIO_ANCLA_INT = 0.024
const RADIO_ANCLA_EXT = 0.034
const Z_ANCLA = 0.0015
const OPACIDAD_ANCLA = 0.58
const OPACIDAD_BADGE = 0.95
// P2 dejo aqui escrito el problema que no sabia resolver: "el offset es el mismo para los 8
// pines, asi que la separacion entre dos badges es la separacion entre sus pines; WTI y
// gasLuisiana (~24.7px) con una placa de ~43px SIEMPRE se solapan". Este es el sitio donde se
// resuelve, y la respuesta es que ninguna etiqueta POR PIN cabe en este catalogo, ni siquiera una
// compacta — la medicion que lo cierra esta en duenoBadge. P3 pinta UN badge como maximo en toda
// la escena, asi que el solape deja de existir por construccion.

// Separacion del badge respecto de la superficie, A LO LARGO DE LA NORMAL (sistema local del pin).
const POS_BADGE_NORMAL = 0.052
// Y su desplazamiento sobre el marcador, que P3 saca del sistema local del pin y pasa al del
// globo. El bug: `orientacion` es la rotacion MINIMA de +Z a la normal, lo que fija el eje Z pero
// deja suelto el giro de los ejes X/Y — asi que el "arriba" local de cada pin apunta a donde
// toque. Medido sobre el catalogo, el badge salia a 147 grados en brent, 99 en crudoOriente, -33
// en plataMexico y -82 en gasLuisiana: o sea que tres de los cuatro pines del cumulo de
// Centroamerica empujaban su etiqueta HACIA ABAJO, contra sus vecinos, y no habia dos etiquetas
// del mismo lado. Una etiqueta que sale por un lado distinto en cada marcador no se lee como "de
// este marcador", se lee como suelta — y dentro de un cumulo de cuatro, como del de al lado.
// Deshaciendo la orientacion (ver orientacionInversa) el desplazamiento pasa a ser el eje del
// globo, que proyecta a "arriba" en pantalla para los 8 por igual, y ademas es la convencion de
// etiqueta de mapa: la placa pertenece al marcador que tiene DEBAJO.
// Aire resultante: 1.6px contra el marco de hover de la reticula, 6.1px contra la placa dura del
// cuerpo, y el borde inferior de la placa nunca cruza el foso.
const POS_BADGE_ALTO = 0.104

// F0-09 — radio de la esfera invisible de golpe (raycast): contrato minimo 0.07 (plan 009
// §1.3); con puntero grueso (dedo) sube a 0.12 (~12px de target en pantalla a la camara del
// hero). matchMedia por capacidad, no por UA — un laptop tactil con raton sigue usando el
// radio fino. Con 0.12 dos pins vecinos pueden solapar esferas (WTI y gasLuisiana estan a
// ~0.138 de corda): la desambiguacion vive en raycastPin (GloboHolografico.tsx), eligiendo
// el pin mas centrado bajo el dedo en vez de subir mas el radio.
const RADIO_HIT = 0.07
const RADIO_HIT_TACTIL = 0.12
const RADIO_HIT_ACTUAL =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? RADIO_HIT_TACTIL : RADIO_HIT

function recortar01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

// Smoothstep 0..1 (el mismo truco de suavidad que el shader): fundidos de estado sin umbral
// duro — usado para la cara oculta del pin (F0-04).
function fundido01(x: number): number {
  const t = recortar01(x)
  return t * t * (3 - 2 * t)
}

// easeOutQuint: ES la curva de --ease-out (cubic-bezier(0.23, 1, 0.32, 1)) de globals.css, no
// una aproximacion — arranca rapido y aterriza suave, porque la entrada de algo nuevo debe
// sentirse inmediata y nunca pesada. El exponente 4 anterior afirmaba esa equivalencia en el
// comentario sin cumplirla: medido en x=0.5, la bezier da 0.966, la quintica 0.969 y la
// cuartica 0.938. Ojo con la tentacion de bajarla a cubica para igualarla al easeOutCubic del
// resto del canvas: triplicaria la desviacion respecto de --ease-out (cubica = 0.875) — serian
// dos curvas distintas, no una unificada.
function suaveSalida(t: number): number {
  return 1 - Math.pow(1 - t, 5)
}

// Decaimiento del destello, deliberadamente SEPARADO de suaveSalida aunque hoy comparta forma
// con la cuartica que esta tenia antes. Son dos gestos distintos: suaveSalida es la ENTRADA de
// algo que llega (y por eso debe ser easeOutQuint = --ease-out), mientras esto es la COLA de un
// golpe de brillo que se apaga. Cuando ambos compartian funcion, corregir el exponente de la
// entrada aceleraba el destello de rebote (en p=0.5 el boost caia de 0.0625 a 0.0313) — un
// cambio de animacion que nadie habia juzgado, colado dentro de una correccion de curva ajena.
// El exponente 4 preserva el decaimiento exacto que la ronda F1 valido; si alguna revision de
// motion quiere otra cola, este es el unico sitio que hay que tocar.
function decaimientoDestello(t: number): number {
  return Math.pow(1 - t, 4)
}

// =================================================================================================
// P3 — ANATOMIA DEL CUERPO. El sistema de canales de P1 se queda tal cual (silueta=TIPO,
// reticula=ESTADO, badge=DIRECCION) y la tecnica tambien (sprite billboard con la silueta
// horneada por tipo). Lo que se rehace, otra vez, es el INTERIOR de la silueta.
//
// Que fallo en pantalla, con numeros: el aro del cuerpo NO tiene contraste de luminancia contra
// un punto de tierra. #7fd4ff esta en L=0.588; el aro de energia en L=0.551 y el de metal en
// L=0.550 → 1.06:1 los dos. Y no es que estos dos tonos esten mal elegidos: el techo absoluto,
// blanco puro sobre ese cian, se queda en 1.65:1, por debajo del 3:1 que WCAG 1.4.11 pide a un
// indicador no textual. NINGUNA tinta clara se separa del mapa por brillo.
//
// O sea que el unico separador posible es el escalon oscuro — y P2 lo dimensiono mal. Su knockout
// era una banda de 8px de textura, ~1.16px en pantalla, mas fina que los propios puntos de tierra
// (1-4px). Una linea mas fina que el grano del fondo no abre un hueco en ese grano: se mete entre
// los puntos y desaparece. Por eso en la captura los 5 pines de metal no existian.
//
// P3 cambia el knockout de CONTORNO a FOSO: tres bandas concentricas de --globe-base que suman
// 21 px de textura (~3.8px en desktop, ~2.4px en movil), con opacidad acumulada creciente hacia
// dentro. Medido sobre un punto de tierra, cada banda vale (P4 sube la primera, ver BANDAS_FOSO):
//   0.50 → 3.30:1 contra el punto (el desvanecido: apaga el grano sin recortar un disco negro,
//          y desde P4 cumple por si solo el 3:1 de WCAG 1.4.11 en vez de quedarse en penumbra)
//   0.66 → 5.29:1 (el escalon de verdad)
//   0.95 → 11.23:1 (suelo del marcador: practicamente --globe-base, pase lo que pase debajo)
// Con ese suelo, el aro mide 10.58:1 contra el fondo que tiene inmediatamente alrededor AUNQUE el
// pin caiga encima del cumulo de puntos mas denso. Ese 10.58 es el numero que P2 no tenia.
//
// El marcador, de fuera a dentro:
//
//        ┌─ foso, banda 0.34 ──── desvanecido: el marcador se posa, no se pega
//        │ ┌─ foso, banda 0.66 ── el escalon
//        │ │ ┌─ foso, banda 0.95 ─ suelo: aqui el mapa ya no esta
//        │ │ │  ┌─ aro de tinta ── el borde nitido: TODO el brillo vive aqui
//        │ │ │  │  ┌─ relleno translucido ── el cuerpo: dice "hay algo", no grita
//        │ │ │  │  │  ┌─ punto central ───── el punto de mira, comun a los dos tipos
//
// Tonos (ni un degradado; a 13-23px tres valores es el techo real):
//   1. foso      --globe-base en tres pasadas (ver BANDAS_FOSO)
//   2. relleno   tinta de TIPO al 0.32 sobre el foso — 2.04:1 contra --globe-base. No tiene que
//                cargar el contraste con el mapa (eso es el foso) pero SI tiene que tener color
//                propio, o el cuerpo se lee como un aro hueco; va enmarcado por un aro a 5.6:1.
//   3. aro+punto tinta de TIPO a tinta plena — 11.35:1 contra --globe-base, en los DOS tipos
//                (ver COLOR_METAL en pin-estados.ts: el hex del metal esta elegido para eso, y
//                por eso P3 pudo borrar la correccion de alpha que P2 necesitaba).
//
// El punto central es circular en los DOS tipos a proposito: es el punto de mira, una constante,
// no un canal. Lo que codifica TIPO es la silueta — y la llevan el aro Y el foso, los dos.
// =================================================================================================

// --- Anatomia en px de la textura (128², centro 64). Todas las extensiones son "medio lado" para
// el cuadrado y "radio" para el disco, asi la misma cuenta sirve a los dos.
const TEX_CUERPO = 128
// Paridad de tamaño entre siluetas, con la misma reparticion que P2: el aro del cuadrado va al
// 85% del disco (iguala la TINTA, que es perimetro) y la silueta exterior acaba en el 88% (el
// overshoot tipografico clasico con el que un cuadrado y un circulo se leen del mismo tamaño).
// El PESO del aro y el punto central son identicos en los dos tipos: son tinta, no tamaño.
// P4 — el aro engorda de 11 a 13 (~2.0px -> ~2.37px en desktop, ~1.26 -> ~1.48px en movil) y la
// linea media baja 1px en los dos tipos para compensarlo, de 31.5 a 30.5 y de 26.8 a 25.8. Asi el
// aro crece HACIA DENTRO: su borde exterior se queda clavado donde estaba (disco 37, cuadrado
// 32.3), y con el se quedan clavados el foso entero, la silueta exterior de 58px (21.2px
// renderizados) y por tanto el hueco de 3.5px del par WTI–gasLuisiana, que es el numero de
// catalogo que fija el techo de TAM_CUERPO. Un aro mas gordo que empujara hacia fuera habria
// comprado presencia a cambio de ese hueco.
// La proporcion entre tipos tampoco se mueve: 25.8/30.5 = 84.6%, el mismo ~85% con el que P2
// iguala la TINTA (que es perimetro) entre cuadrado y disco.
const EXT_ARO_DISCO = 30.5 // linea media del aro
const EXT_ARO_CUADRADO = 25.8
// El aro es el UNICO sitio del marcador donde vive tinta plena, asi que engordarlo es la forma de
// ganar presencia que no pasa por TAM_CUERPO. El techo son los 13: a partir de ahi el aro seria
// mas grueso que el diametro del punto central, y un borde que pesa mas que su propio punto de
// mira convierte el cuerpo en una rosquilla.
const PESO_ARO = 13
// P4 — 9 -> 10 (∅3.3px -> ∅3.6px en desktop, ∅2.1 -> ∅2.3px en movil). El punto de mira es donde
// aterriza el ojo a 23px; crece a la par que el aro para que el reparto de tinta entre borde y
// centro no se desequilibre. El techo lo pone el anillo de RELLENO que queda entre punto y aro,
// que desde P4 es el que da identidad de color al interior y por tanto no puede desaparecer: en
// el cuadrado (borde interior del aro a 19.3) son 9.3px de textura, 1.69px en desktop y 1.06px en
// movil. Ese 1.06 es el limite — del mismo orden que el 1.03px con el que ya vive el suelo del
// foso en movil — y es la razon de que el punto no pase de 10.
const RADIO_PUNTO = 10
// P4 — 0.22 -> 0.32. El relleno es el interior del marcador y al 0.22 media 1.53:1 contra
// --globe-base: a 23px eso se lee como un aro hueco, no como una ficha. A 0.32 mide 2.04:1 — el
// interior tiene por fin identidad de color, que es lo que deja distinguir "disco ambar" de
// "cuadrado violeta" sin tener que resolver la silueta. Lo que NO se pierde:
//   · el aro sigue siendo el portador de contraste, a 5.57:1 sobre el relleno (antes 7.40)
//   · el relleno sigue siendo mas oscuro que el mapa: 5.91:1 contra un punto de tierra (antes
//     7.85), muy por encima del 3:1 de WCAG 1.4.11 — o sea que subirlo no devuelve el pin al mapa
//   · la paridad entre tipos aguanta en el 1.6%, bajo la tolerancia del 2% que vigila el test
const ALFA_RELLENO = 0.32
const TINTA_PLACA = '#020a18' // --globe-base
// El foso, de fuera a dentro. `extra` es la extension EXTRA sobre el borde exterior del aro y
// `opacidad` es la que la banda debe ALCANZAR (acumulada, no la del trazo) — crearTexturaCuerpo
// despeja el alpha de cada pasada. Expresarlo asi es lo que permite leer la tabla de contrastes
// de arriba directamente en el codigo en vez de tener que componer alphas a mano.
//
// P4 toca una sola celda: la opacidad de la banda exterior, 0.34 -> 0.50. Era el eslabon flojo
// del foso — a 0.34 media 2.14:1 contra un punto de tierra, por debajo del 3:1 que WCAG 1.4.11
// pide a un indicador no textual, asi que el borde del foso era una penumbra y el marcador
// parecia posado sobre una mancha en vez de metido en un hueco. A 0.50 mide 3.30:1 y las TRES
// bandas cumplen el umbral sin dejar de ser una rampa (0.50 -> 0.66 -> 0.95): sigue habiendo
// desvanecido, no recorte. Las extensiones NO se tocan, y es deliberado: son las que fijan la
// silueta exterior en 58px, que es de donde sale el hueco de catalogo entre WTI y gasLuisiana.
const BANDAS_FOSO: readonly { extra: number; opacidad: number }[] = [
  { extra: 21, opacidad: 0.5 },
  { extra: 15, opacidad: 0.66 },
  { extra: 9, opacidad: 0.95 },
]
// El cuadrado estrecha sus bandas un 10% para que su silueta exterior caiga en el 88% del disco
// (lado 102 contra ∅116) pese a partir de un aro al 85%.
const FACTOR_FOSO_CUADRADO = 0.9
// El rombo (futuros de indices) reutiliza TODAS las medidas del cuadrado (aro, foso, relleno) y
// solo cambia la forma de trazarlas: es el cuadrado girado 45 grados. Una medida "de cuadrado"
// de extension e (medio lado) pasa a un rombo de INRADIO e * FACTOR_ROMBO, es decir semidiagonal
// e * FACTOR_ROMBO * sqrt(2). Con 0.8 la punta de la silueta exterior cae en 58px de textura,
// exactamente donde cae la del disco (51.2 * 0.8 * 1.414), asi que no se sale de los 6px de
// margen transparente que protegen el mip y el hueco de catalogo WTI–gasLuisiana no cambia.
// El grosor del aro se mantiene perpendicular a las aristas (PESO_ARO igual que en los otros).
const FACTOR_ROMBO = 0.8
const SEMIDIAGONAL_POR_EXTENSION = FACTOR_ROMBO * Math.SQRT2

// Traza la silueta del TIPO a la extension pedida. Un solo sitio para la forma: el disco y el
// cuadrado tienen que compartir la geometria para que cambiar una extension no desalinee un tipo.
function trazarSilueta(ctx: CanvasRenderingContext2D, silueta: SiluetaPin, extension: number): void {
  const centro = TEX_CUERPO / 2
  ctx.beginPath()
  if (silueta === 'disco') ctx.arc(centro, centro, extension, 0, Math.PI * 2)
  else if (silueta === 'rombo') {
    const d = extension * SEMIDIAGONAL_POR_EXTENSION
    ctx.moveTo(centro, centro - d)
    ctx.lineTo(centro + d, centro)
    ctx.lineTo(centro, centro + d)
    ctx.lineTo(centro - d, centro)
    ctx.closePath()
  } else ctx.rect(centro - extension, centro - extension, extension * 2, extension * 2)
}

// Una textura por TIPO (disco, cuadrado, rombo), compartida por los 8 pines, con el color y los tres tonos YA horneados.
// Hornearlo (en vez de dibujar en blanco y tiñir con spriteMaterial.color) es lo que permite que
// coexistan la placa oscura y la tinta: un tinte de material habria teñido las dos.
//
// 128² y no mas: el sprite mide 23.3px en desktop (minificacion 5.5x) y 14.6px en movil (8.8x),
// asi que CanvasTexture — con generateMipmaps y LinearMipmapLinear por defecto — muestrea entre
// el nivel 2 y el 3 de la cadena de mips. A 128 esa cadena es exacta (potencia de dos, sin
// reescalado al subirla) y aterriza justo en el tamaño de render, que es la condicion para que no
// alie. Subir a 256 solo haria que la GPU bajara un nivel mas de mip: mismo resultado, doble de
// memoria. Y el criterio de "no alia" se cumple feature a feature — al nivel muestreado el aro
// mide 2.37px, el punto 3.6px y el suelo del foso 1.64px, todos >= 1px; en movil la
// banda del suelo baja a 1.03px, que es justo el limite, y las dos bandas de desvanecido caen a
// 0.80px — ahi dejan de ser bandas y pasan a ser el suavizado del borde, que es exactamente para
// lo que estan. La anisotropia no aplica: el sprite es billboard, nunca se minifica en oblicuo.
// Los 6px de margen transparente alrededor del foso evitan que el mip arrastre el borde.
function crearTexturaCuerpo(silueta: SiluetaPin, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_CUERPO
  canvas.height = TEX_CUERPO
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Esquinas vivas: que el cuadrado TENGA esquinas es el canal de TIPO, un join redondeado se
    // lo comeria justo al tamaño en el que hay que distinguirlo del disco.
    ctx.lineJoin = 'miter'
    ctx.miterLimit = 4

    const extAro = silueta === 'disco' ? EXT_ARO_DISCO : EXT_ARO_CUADRADO
    const bordeAro = extAro + PESO_ARO / 2
    const factorFoso = silueta === 'disco' ? 1 : FACTOR_FOSO_CUADRADO

    // Tono 1 — el foso. Tres siluetas llenas de fuera a dentro; la ultima tapa ademas todo el
    // interior, asi que el mismo trazo que separa del mapa es el suelo sobre el que se compone el
    // relleno. Como cada pasada se pinta ENCIMA de la anterior, el alpha del trazo no es la
    // opacidad que se busca sino la que falta para llegar a ella: de ahi el despeje.
    ctx.fillStyle = TINTA_PLACA
    let acumulada = 0
    for (const banda of BANDAS_FOSO) {
      ctx.globalAlpha = (banda.opacidad - acumulada) / (1 - acumulada)
      trazarSilueta(ctx, silueta, bordeAro + banda.extra * factorFoso)
      ctx.fill()
      acumulada = banda.opacidad
    }

    // Tono 2 — relleno translucido, hasta el borde EXTERIOR del aro y no hasta el interior: asi
    // el aro se traza entero encima del relleno, con un respaldo uniforme. Si el relleno acabara
    // en el borde interior, el antialias dejaria una costura de foso entre aro y relleno, y la
    // mitad exterior del aro se compondria sobre un tono distinto que la interior — un degradado
    // de 1px, que es exactamente lo que a este tamaño no se puede permitir.
    ctx.globalAlpha = ALFA_RELLENO
    ctx.fillStyle = color
    trazarSilueta(ctx, silueta, bordeAro)
    ctx.fill()

    // Tono 3 — aro + punto central, la misma tinta al mismo alpha para que sean UN tono y no dos.
    ctx.globalAlpha = 1
    ctx.strokeStyle = color
    ctx.lineWidth = PESO_ARO
    trazarSilueta(ctx, silueta, extAro)
    ctx.stroke()
    ctx.fillStyle = color
    trazarSilueta(ctx, 'disco', RADIO_PUNTO)
    ctx.fill()

    ctx.globalAlpha = 1
  }
  const textura = new THREE.CanvasTexture(canvas)
  textura.needsUpdate = true
  textura.colorSpace = THREE.SRGBColorSpace
  return textura
}

// P1 — reticula de ESTADO: cuatro corchetes de esquina, en blanco para que spriteMaterial.color
// los tiña con COLOR_RETICULA (aqui si conviene el tinte: un solo tono, sin knockout — una
// hairline cian sobre el globo oscuro no necesita separacion).
// Se generan DOS texturas con la misma caja y el mismo grosor: la base dibuja el brazo de 0 a
// 0.22 del lado y la extension SOLO el tramo de 0.25 a 0.44. Al no solaparse, encender la
// extension lee como "el brazo crece" y no como "hay dos lineas encima" — y la opacidad compuesta
// de la base no sufre el bajon que tendria un cross-fade entre dos reticulas completas.
function crearTexturaReticula(desde: number, hasta: number): THREE.CanvasTexture {
  const tam = 128
  const margen = 14
  const lado = tam - margen * 2 // 100: el marco ocupa el 78% de la textura
  const canvas = document.createElement('canvas')
  canvas.width = tam
  canvas.height = tam
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.strokeStyle = '#ffffff'
    // P3 — 8 -> 7.5 por el mismo motivo que P2 bajo de 9 a 8, y con el mismo objetivo: CONSERVAR
    // el peso renderizado del canal de ESTADO cuando la caja crece. Con TAM_RETICULA en 0.128 un
    // trazo de 8 daria 2.06px en hover, que ya no es hairline sino borde. A 7.5 vuelve a 1.93px
    // en hover y 1.54px en seleccion, los mismos ~1.9/~1.5 que P1 fijo. El medio pixel de textura
    // no es un problema: a 5.5x de minificacion el mip lo promedia igual que a cualquier entero.
    ctx.lineWidth = 7.5
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'miter'
    const a = desde * lado
    const b = hasta * lado
    // [x, y, signo x hacia dentro, signo y hacia dentro] de las cuatro esquinas del marco.
    const esquinas: readonly (readonly [number, number, number, number])[] = [
      [margen, margen, 1, 1],
      [tam - margen, margen, -1, 1],
      [tam - margen, tam - margen, -1, -1],
      [margen, tam - margen, 1, -1],
    ]
    for (const [cx, cy, sx, sy] of esquinas) {
      ctx.beginPath()
      if (a === 0) {
        // Corchete: un solo trazo en L para que la esquina salga en angulo vivo (miter) en vez
        // de dos segmentos con una muesca entre ellos.
        ctx.moveTo(cx + sx * b, cy)
        ctx.lineTo(cx, cy)
        ctx.lineTo(cx, cy + sy * b)
      } else {
        ctx.moveTo(cx + sx * a, cy)
        ctx.lineTo(cx + sx * b, cy)
        ctx.moveTo(cx, cy + sy * a)
        ctx.lineTo(cx, cy + sy * b)
      }
      ctx.stroke()
    }
  }
  const textura = new THREE.CanvasTexture(canvas)
  textura.needsUpdate = true
  textura.colorSpace = THREE.SRGBColorSpace
  return textura
}

// Badge live del pin: placa oscura con el texto del delta en su color de token, mismo patron
// que las etiquetas HUD de GloboHolografico.tsx (canvas + roundRect + Inter). La placa es
// imprescindible: texto suelto sobre el globo se pierde contra los puntos de tierra.
// V3 — la placa crece con el badge: 18px de alto y 11px de fuente (antes 16/10), los dos a
// `escala`. El resto de la geometria se deriva de `alto` y no de constantes sueltas (radio del
// roundRect, centro vertical, proporcion devuelta), asi que sigue cuadrando sin tocar nada mas.
function crearTexturaDelta(texto: string, color: string): { textura: THREE.CanvasTexture; proporcion: number } {
  const escala = 4
  const alto = 18 * escala
  const tamFuente = 11 * escala
  const medidor = document.createElement('canvas').getContext('2d')
  let anchoTexto = 96 * escala
  if (medidor) {
    // Mismo `font` que el fillText de abajo (de ahi la constante compartida): si los dos
    // valores se separan, el ancho medido deja de cuadrar con el texto pintado y la placa
    // recorta o se queda larga.
    medidor.font = `700 ${tamFuente}px Inter, sans-serif`
    anchoTexto = Math.ceil(medidor.measureText(texto).width)
  }
  const paddingX = 8 * escala
  const ancho = anchoTexto + paddingX * 2
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // P3 — 0.82 -> 0.92. La placa del badge tiene el mismo trabajo que el foso del cuerpo:
    // apagar los puntos de tierra que caen detras. Al 0.82 pasaba el 18% del cumulo de puntos y
    // sobre el continente la placa dejaba de leerse como placa. Al 0.92 mide 11.2:1
    // contra un punto de tierra, el mismo escalon que el suelo del foso.
    ctx.fillStyle = 'rgba(2, 10, 24, 0.92)' // --globe-base (#020a18) con alpha
    ctx.beginPath()
    ctx.roundRect(0, 0, ancho, alto, alto * 0.32)
    ctx.fill()
    // V3 — el borde se tiñe con el mismo color de estado que el texto en vez de quedarse en
    // cian fijo: con un delta positivo una placa de marco cian mandaba dos señales de color a la
    // vez y a tamaño de badge el marco es lo primero que se lee. El alpha se queda en el 0.3 de
    // siempre a proposito — se cambia el tono, no el peso del borde, que solo esta ahi para
    // separar la placa de los puntos de tierra. P1 lo deja igual: el marco repite la DIRECCION,
    // que es el mismo significado que la tinta del texto, asi que no abre un canal nuevo.
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.3
    ctx.lineWidth = escala
    ctx.stroke()
    ctx.globalAlpha = 1

    ctx.font = `700 ${tamFuente}px Inter, sans-serif`
    ctx.fillStyle = color // color ya resuelto por colorDelta (token semantico de direccion)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(texto, ancho / 2, alto / 2)
  }
  const textura = new THREE.CanvasTexture(canvas)
  textura.needsUpdate = true
  textura.colorSpace = THREE.SRGBColorSpace
  return { textura, proporcion: ancho / alto }
}

// P1 — todo lo que vive en la GPU y es identico para los 8 pines se crea UNA vez en el padre y
// viaja por prop: dos texturas de cuerpo (una por tipo), dos de reticula y la geometria del
// anillo de contacto. Antes la gema tenia su propia IcosahedronGeometry por pin con su dispose
// por pin; concentrarlo aqui deja a Pin sin un solo recurso de GPU propio, y por tanto sin
// ninguna forma de filtrarlo en un remount.
interface RecursosPin {
  cuerpo: Record<SiluetaPin, THREE.CanvasTexture>
  reticulaBase: THREE.CanvasTexture
  reticulaExtension: THREE.CanvasTexture
  ancla: THREE.RingGeometry
}

function crearRecursosPin(): RecursosPin {
  return {
    cuerpo: {
      disco: crearTexturaCuerpo('disco', colorCuerpo('energia')),
      cuadrado: crearTexturaCuerpo('cuadrado', colorCuerpo('metal')),
      rombo: crearTexturaCuerpo('rombo', colorCuerpo('indice')),
    },
    reticulaBase: crearTexturaReticula(0, 0.22),
    reticulaExtension: crearTexturaReticula(0.25, 0.44),
    ancla: new THREE.RingGeometry(RADIO_ANCLA_INT, RADIO_ANCLA_EXT, 24),
  }
}

function liberarRecursosPin(recursos: RecursosPin): void {
  recursos.cuerpo.disco.dispose()
  recursos.cuerpo.cuadrado.dispose()
  recursos.cuerpo.rombo.dispose()
  recursos.reticulaBase.dispose()
  recursos.reticulaExtension.dispose()
  recursos.ancla.dispose()
}

interface PinProps {
  marcador: Marcador
  indice: number // posicion en MARCADORES: base del stagger de entrada y de la fase del pulso
  seleccionado: boolean
  resaltado: boolean
  // P3 — este pin es el que tiene la atencion y por tanto el unico que imprime el ±%. Lo decide
  // el padre (ver duenoBadge) y no `seleccionado || resaltado`, porque la garantia que hace falta
  // es que como maximo haya UNO en toda la escena.
  badgeVisible: boolean
  cotizacion: CotizacionPin | undefined
  registrarHit: (id: string, obj: THREE.Object3D | null) => void
  reducedMotion: boolean
  revelado: boolean
  entradaRetrasoMs: number
  recursos: RecursosPin
}

function Pin({
  marcador,
  indice,
  seleccionado,
  resaltado,
  badgeVisible,
  cotizacion,
  registrarHit,
  reducedMotion,
  revelado,
  entradaRetrasoMs,
  recursos,
}: PinProps) {
  // Estado y textos se recalculan en cada render (barato, puro — ver lib/globe/pin-estados.ts).
  const cambio = cotizacion?.cambio ?? null
  const estado = clasificarEstadoPin(seleccionado, resaltado)
  // Canal TIPO: silueta y color salen los dos del tipo y de nada mas. Ninguna de las dos
  // funciones acepta un EstadoPin, y eso es el contrato — es lo que impide que "seleccionado"
  // vuelva a colarse dentro del cuerpo del pin.
  const silueta = siluetaCuerpo(marcador.tipo)
  const tintaCuerpo = colorCuerpo(marcador.tipo)
  const textoDelta = formatearDelta(cambio)
  const tintaDelta = colorDelta(cambio)

  const pos = useMemo(() => latLonAVector3(gradosARadianes(marcador.lat), gradosARadianes(marcador.lon), 1), [marcador])
  const normal = useMemo(() => new THREE.Vector3(pos.x, pos.y, pos.z), [pos])
  const orientacion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), [normal])
  // Deshace la orientacion del pin para la capa del badge: dentro de ese grupo, +Y vuelve a ser el
  // eje del globo (ver POS_BADGE_ALTO). Se calcula una vez por marcador, no por frame.
  const orientacionInversa = useMemo(() => orientacion.clone().invert(), [orientacion])
  const posicion: [number, number, number] = [pos.x, pos.y, pos.z]

  // Badge: solo existe textura si hay delta util (sin cotizacion no se pinta nada — nada de
  // "0.00%" inventado). Se recrea solo cuando cambia el texto o su color.
  const texturaBadge = useMemo(
    () => (textoDelta && tintaDelta ? crearTexturaDelta(textoDelta, tintaDelta) : null),
    [textoDelta, tintaDelta]
  )
  useEffect(() => {
    return () => {
      texturaBadge?.textura.dispose()
    }
  }, [texturaBadge])

  const grupoRef = useRef<THREE.Group>(null) // grupo con posicion/orientacion (cara oculta)
  const visualRef = useRef<THREE.Group>(null) // capa que hace el Pop in de entrada
  const cuerpoMatRef = useRef<THREE.SpriteMaterial>(null)
  const reticulaBaseRef = useRef<THREE.Sprite>(null)
  const reticulaBaseMatRef = useRef<THREE.SpriteMaterial>(null)
  const reticulaExtRef = useRef<THREE.Sprite>(null)
  const reticulaExtMatRef = useRef<THREE.SpriteMaterial>(null)
  const anclaMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const badgeRef = useRef<THREE.Sprite>(null)
  const badgeMatRef = useRef<THREE.SpriteMaterial>(null)
  const hitRef = useRef<THREE.Mesh>(null)

  // La esfera invisible (radio mayor que el pin) es el objetivo real del raycast — mas facil de
  // acertar con el dedo que el cuerpo visual (plan 009 §1.3). Vive FUERA de la capa de entrada:
  // aunque el pin este oculto por revelado=false o jugando su Pop in, el contrato de radio
  // >= 0.07 y el registro para tap/hover no cambian jamas.
  useEffect(() => {
    if (hitRef.current) hitRef.current.userData.id = marcador.id
    registrarHit(marcador.id, hitRef.current)
    return () => registrarHit(marcador.id, null)
  }, [marcador.id, registrarHit])

  // Relojes internos: entrada (Pop in), destello del delta y deteccion de cambio de cotizacion.
  const inicioEntradaRef = useRef<number | null>(null)
  const cambioPrevioRef = useRef<number | null | undefined>(cambio)
  const inicioFlashRef = useRef<number | null>(null)

  const normalMundo = useMemo(() => new THREE.Vector3(), [])
  const dirCamara = useMemo(() => new THREE.Vector3(), [])
  // Amortiguadores de estado (F0-04): la opacidad de cara oculta y los tres numeros de la
  // reticula persiguen su objetivo con k=1-exp(-16*dt) — interrumpibles a mitad de vuelo
  // (hover -> seleccion reutiliza la velocidad en curso, no reinicia), a diferencia de una
  // asignacion seca por frame. Constante de tiempo 1/16 = 62.5ms, ~95% recorrido en ~190ms:
  // dentro del techo de 300ms que esta ronda tiene para motion nuevo. Con reducedMotion, snap
  // (k=1): estados puros, sin movimiento.
  const opacidadCaraRef = useRef(1)
  const escalaReticulaRef = useRef(escalaReticula('inactivo'))
  const opacidadReticulaRef = useRef(opacidadReticula('inactivo'))
  const cierreReticulaRef = useRef(cierreReticula('inactivo'))
  // P3 — presencia del badge (0 = oculto, 1 = puesto). Se amortigua con el MISMO k que la
  // reticula en vez de montar y desmontar el sprite: una placa que aparece y desaparece de golpe
  // al pasar el raton es un parpadeo, y ademas obligaria a React a reconciliar la escena en cada
  // movimiento del puntero. Con reducedMotion el k vale 1 y el cambio es seco, que es lo
  // correcto: estados puros, sin movimiento.
  const mezclaBadgeRef = useRef(badgeVisible ? 1 : 0)
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    const k = reducedMotion ? 1 : 1 - Math.exp(-16 * Math.min(delta, 0.1))

    // Cara oculta del pin: en vez del umbral duro viejo (dot > -0.05 ? 1 : 0.15), un smoothstep
    // que funde de 0.15 a 1 al girar el globo, y encima amortiguado — el pin nunca "salta" de
    // opacidad al cruzar el limbo (F0-04).
    let objetivoCara = 1
    if (grupoRef.current) {
      grupoRef.current.getWorldPosition(normalMundo)
      dirCamara.copy(state.camera.position).normalize()
      const dot = normalMundo.normalize().dot(dirCamara)
      objetivoCara = 0.15 + 0.85 * fundido01((dot + 0.2) / 0.3)
    }
    opacidadCaraRef.current += (objetivoCara - opacidadCaraRef.current) * k
    const opacidadBase = opacidadCaraRef.current

    // Entrada: Pop in escalonado (Stagger) — el primer pin arranca `entradaRetrasoMs` (base de
    // la coreografia F3: 1600ms, tras el ultimo anillo HUD) y cada uno suma STAGGER_ENTRADA_MS
    // (patron 1600 + 60*indice del plan F0-08). Con revelado=false el pin espera oculto; con
    // reduced-motion aparece ya puesto, sin animacion.
    let progresoEntrada = 1
    if (!revelado) {
      inicioEntradaRef.current = null
      progresoEntrada = 0
    } else {
      if (inicioEntradaRef.current === null) {
        inicioEntradaRef.current = t + (entradaRetrasoMs + indice * STAGGER_ENTRADA_MS) / 1000
      }
      progresoEntrada = reducedMotion ? 1 : suaveSalida(recortar01((t - inicioEntradaRef.current) / DURACION_ENTRADA))
    }

    // Destello: solo cuando el delta de la cotizacion CAMBIA respecto al valor anterior (el
    // primer dato que llega cuenta como cambio — el badge aparece con un golpe de brillo).
    // Sin reduced-motion no hay destello: estados estaticos, punto.
    if (cambio !== cambioPrevioRef.current) inicioFlashRef.current = t
    cambioPrevioRef.current = cambio
    const boost =
      inicioFlashRef.current === null || reducedMotion
        ? 0
        : decaimientoDestello(recortar01((t - inicioFlashRef.current) / DURACION_FLASH))

    // Pulse SOLO con senal: el latido existe cuando hay cambio intradia real. El idle sin senal
    // queda absolutamente quieto (sin pulso infinito decorativo), y cada pin lleva su propia fase
    // para que los 8 no respiren sincronizados.
    // P1 — el latido se mudo del halo (muerto) a la marca de contacto, y SOLO en brillo: la onda,
    // la frecuencia (2.4), la fase (1.7*indice) y la amplitud de brillo (0.8..1.2) son byte a byte
    // las de F1, para no reabrir una decision de motion dentro de un rediseño de color. El factor
    // de ESCALA del pulso (0.92..1.08) si se cayo: un ancla que respira de tamaño contradice lo
    // unico que el ancla tiene que decir, que es "esto esta clavado aqui".
    const pulsando = !reducedMotion && tieneSenalIntradia(cambio)
    const onda = 0.5 + 0.5 * Math.sin(t * 2.4 + indice * 1.7)
    const factorBrilloPulso = pulsando ? 0.8 + 0.4 * onda : 1

    // opacidad compuesta: cara oculta × entrada (el destello solo suma brillo, no visibilidad)
    const opacidad = opacidadBase * progresoEntrada

    // Canal ESTADO: los tres numeros de la reticula persiguen su objetivo con el mismo k. Nada de
    // esto toca un color — la tinta es COLOR_RETICULA en los tres estados, fijada en el JSX.
    escalaReticulaRef.current += (escalaReticula(estado) - escalaReticulaRef.current) * k
    opacidadReticulaRef.current += (opacidadReticula(estado) - opacidadReticulaRef.current) * k
    cierreReticulaRef.current += (cierreReticula(estado) - cierreReticulaRef.current) * k

    if (visualRef.current) visualRef.current.scale.setScalar(0.9 + 0.1 * progresoEntrada)
    if (cuerpoMatRef.current) cuerpoMatRef.current.opacity = opacidad
    if (anclaMatRef.current) {
      anclaMatRef.current.opacity = Math.min(1, opacidad * (OPACIDAD_ANCLA * factorBrilloPulso + 0.35 * boost))
    }

    const ladoReticula = TAM_RETICULA * escalaReticulaRef.current
    const presencia = opacidad * opacidadReticulaRef.current
    if (reticulaBaseRef.current) reticulaBaseRef.current.scale.set(ladoReticula, ladoReticula, 1)
    if (reticulaExtRef.current) reticulaExtRef.current.scale.set(ladoReticula, ladoReticula, 1)
    if (reticulaBaseMatRef.current) reticulaBaseMatRef.current.opacity = presencia
    if (reticulaExtMatRef.current) reticulaExtMatRef.current.opacity = presencia * cierreReticulaRef.current

    // Badge: el destello de dato conserva su factor de siempre; la presencia la pone el pin que
    // tiene la atencion. El sprite existe en los 8 pines y se queda a opacidad 0 en los otros 7.
    mezclaBadgeRef.current += ((badgeVisible ? 1 : 0) - mezclaBadgeRef.current) * k
    const mezcla = mezclaBadgeRef.current
    const factor = 1 + 0.22 * boost
    if (badgeRef.current && badgeMatRef.current && texturaBadge) {
      badgeRef.current.scale.set(ALTO_BADGE * texturaBadge.proporcion * factor, ALTO_BADGE * factor, 1)
      badgeMatRef.current.opacity = opacidad * OPACIDAD_BADGE * mezcla
    }
  })

  return (
    <group ref={grupoRef} position={posicion} quaternion={orientacion}>
      <group ref={visualRef}>
        {/* Capa 1 — ancla = contacto. Lo UNICO del pin que vive en el plano tangente (el anillo
            de RingGeometry nace en XY, y XY local ya es la tangente porque Z local es la normal),
            asi que es lo unico que se escora al girar el globo. Ese escorzo es el que amarra el
            marcador a la esfera; las capas billboard de arriba no podrian hacerlo sin ponerse de
            canto. DoubleSide para que siga existiendo en la cara oculta, donde se ve por detras.
            P2 — aqui NO se aplica alphaTintaCuerpo, y es deliberado: esa correccion existe porque
            el cuerpo tenia AREA solida compitiendo con la escena, y el ancla es una hairline de
            1.6px ya rebajada al 0.45. Multiplicarla por 0.83 la dejaria en 0.37 y es justo en el
            limbo — donde el ancla es lo unico que hace su trabajo — donde menos puede permitirselo. */}
        <mesh geometry={recursos.ancla} position={[0, 0, Z_ANCLA]}>
          <meshBasicMaterial
            ref={anclaMatRef}
            color={tintaCuerpo}
            toneMapped={false}
            transparent
            opacity={OPACIDAD_ANCLA}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Capa 2 — reticula = ESTADO. Dos sprites (billboard: miran a camara, asi que el giro del
            globo no les deforma el marco) con la misma caja y la misma escala amortiguada. La base
            son los cuatro corchetes cortos; la extension es solo el tramo nuevo del brazo, y su
            opacidad es el "cierre". En reposo las dos estan a opacidad 0: el pin en reposo no
            lleva cromo de estado, lleva su cuerpo y nada mas. */}
        <sprite ref={reticulaBaseRef} position={[0, 0, Z_RETICULA]} scale={ESCALA_RETICULA_REPOSO}>
          <spriteMaterial
            ref={reticulaBaseMatRef}
            map={recursos.reticulaBase}
            color={COLOR_RETICULA}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
        <sprite ref={reticulaExtRef} position={[0, 0, Z_RETICULA]} scale={ESCALA_RETICULA_REPOSO}>
          <spriteMaterial
            ref={reticulaExtMatRef}
            map={recursos.reticulaExtension}
            color={COLOR_RETICULA}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* Capa 3 — cuerpo = TIPO. Sprite (billboard) a proposito, y no un solido: a 12px ninguna
            silueta 3D sobrevive al giro del globo. Una placa plana orientada a la normal se pone
            de canto en el limbo y desaparece; un solido de revolucion alrededor de la normal (cono,
            disco grueso) es invariante en azimut pero NO en el angulo polar — de frente se lee como
            un circulo y de lado como un triangulo o una barra, o sea que la silueta cambiaria de
            significado segun donde este el pin sobre el globo, que es precisamente lo que el canal
            de TIPO no puede permitirse. Billboard = la misma silueta en los 8 pines y en cualquier
            rotacion; el amarre a la esfera lo pone la capa 1, que si es tangente. */}
        <sprite position={[0, 0, Z_CUERPO]} scale={[TAM_CUERPO, TAM_CUERPO, 1]}>
          <spriteMaterial
            ref={cuerpoMatRef}
            map={recursos.cuerpo[silueta]}
            transparent
            opacity={1}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* Capa 4 — badge live ±%: placa con el cambio intradia de cotizacionesPines. La DIRECCION
            viaja en la tinta (verde/rojo semantico, los mismos tokens que el anillo HUD) y en la
            flecha, que se queda por WCAG 1.4.1. Sin dato util no se monta (texturaBadge = null).
            El grupo que lo envuelve deshace la orientacion del pin para que la placa salga SIEMPRE
            hacia el norte del globo (= arriba en pantalla) y no a donde caiga el eje Y local; ver
            POS_BADGE_ALTO. Solo se ve en el pin con la atencion: useFrame deja a los otros siete
            en opacidad 0. */}
        <group position={[0, 0, POS_BADGE_NORMAL]} quaternion={orientacionInversa}>
          {texturaBadge && (
            <sprite ref={badgeRef} position={[0, POS_BADGE_ALTO, 0]}>
              <spriteMaterial
                ref={badgeMatRef}
                map={texturaBadge.textura}
                transparent
                opacity={0}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          )}
        </group>
      </group>

      {/* Esfera invisible mas grande: objetivo real del raycast (tap/hover). RADIO_HIT_ACTUAL
          cumple el contrato >= 0.07 y con puntero grueso sube a 0.12 (F0-09); fuera de la capa
          de entrada para que el contrato de hit no dependa del estado. */}
      <mesh ref={hitRef} visible={false}>
        <sphereGeometry args={[RADIO_HIT_ACTUAL, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

interface PinesActivosProps {
  seleccionId: string | null
  resaltadoId: string | null
  registrarHit: (id: string, obj: THREE.Object3D | null) => void
  // --- Nuevas en F1, todas opcionales con defaults que dejan el comportamiento intacto ---
  // reduced-motion global (viene de Escena/HeroGlobe): sin pulsos, sin destellos, sin entrada y
  // con los amortiguadores de la reticula en snap — todo lo decorativo congelado.
  reducedMotion?: boolean
  // El reveal de los puntos de tierra: con default true los pines siguen apareciendo segun su
  // horario propio (el stagger de entrada no depende de que los puntos esten listos).
  revelado?: boolean
  // Retraso base (ms) del primer pin de la cascada + STAGGER_ENTRADA_MS por pin siguiente.
  // F3 pasa 1600 (tras la ventana del ultimo anillo HUD, plan F0-08); 0 = cascada inmediata.
  entradaRetrasoMs?: number
  // cotizacionesPines de page.tsx: badge live ±% y latido con senal del pin.
  cotizaciones?: Record<string, CotizacionPin>
}

export function PinesActivos({
  seleccionId,
  resaltadoId,
  registrarHit,
  reducedMotion = false,
  revelado = true,
  entradaRetrasoMs = 0,
  cotizaciones,
}: PinesActivosProps) {
  // Recursos de GPU unicos para todo el catalogo; se liberan al desmontar (patron de dispose del
  // repo: nada de texturas de canvas ni geometrias huerfanas en la GPU tras un remount).
  const recursos = useMemo(() => crearRecursosPin(), [])
  useEffect(() => {
    return () => {
      liberarRecursosPin(recursos)
    }
  }, [recursos])

  // P3 — quien imprime el ±%. Es un solo id para toda la escena, y esa es justamente la garantia
  // que resuelve el amasijo: con un unico badge ancho en pantalla no hay par de pines que pueda
  // solaparse, da igual lo juntos que caigan sobre el globo.
  // El hover gana a la seleccion porque es donde esta el puntero: al recorrer el cumulo de
  // Centroamerica el numero sigue al dedo en vez de quedarse anclado al pin abierto, que ya tiene
  // su reticula cerrada, su ancla y la TarjetaActivo entera contando su dato.
  //
  // Por que los otros siete se quedan SIN etiqueta de ningun tipo, y no con una compacta: P3 probo
  // un chip de reposo (solo el glifo ▲▼–, ~14px de placa) y no existe posicion viable para el.
  // Medido sobre este catalogo, con el chip centrado sobre el pin y desplazado por la normal:
  //   · para librar el foso de su PROPIO cuerpo hace falta un desplazamiento >= 0.0734
  //   · para no cruzar el cuerpo del VECINO mas cercano (WTI–gasLuisiana, cuerda 0.1246) hay que
  //     quedarse en <= 0.040
  // El intervalo esta vacio, asi que el chip no cabe arriba, ni abajo, ni al lado: cualquier
  // offset que lo saque de su pin lo mete en otro. Subirlo mas (como hace el ±%, en POS_BADGE_ALTO
  // = 0.104) solo funciona porque hay UNO. Que nadie lo reintente sin rehacer antes el catalogo
  // de marcadores: el problema esta en las coordenadas, no en la etiqueta.
  const duenoBadge = resaltadoId ?? seleccionId

  return (
    <>
      {MARCADORES.map((m, indice) => (
        <Pin
          key={m.id}
          marcador={m}
          indice={indice}
          seleccionado={seleccionId === m.id}
          resaltado={resaltadoId === m.id}
          badgeVisible={duenoBadge === m.id}
          cotizacion={cotizaciones?.[m.simbolo]}
          registrarHit={registrarHit}
          reducedMotion={reducedMotion}
          revelado={revelado}
          entradaRetrasoMs={entradaRetrasoMs}
          recursos={recursos}
        />
      ))}
    </>
  )
}
