// GLSL para el globo holografico. Todo corre en el cliente (components/globe/GloboHolografico.tsx
// solo se monta via next/dynamic con ssr:false) y no depende de texturas remotas: la CSP del sitio
// (next.config.ts) solo permite 'self' para imagenes, asi que todo sale de public/globo/.

// --- Esfera base: relleno azul muy oscuro + borde Fresnel ---
export const baseVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const baseFragmentShader = /* glsl */ `
  uniform vec3 uColorBase;
  uniform vec3 uColorBorde;
  uniform float uOpacidad;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(clamp(1.0 - max(dot(vNormal, vViewDir), 0.0), 0.0, 1.0), 3.0);
    vec3 color = mix(uColorBase, uColorBorde, fresnel);
    float alpha = clamp(mix(0.35, 0.9, fresnel) * uOpacidad, 0.0, 1.0);
    gl_FragColor = vec4(min(color, vec3(4.0)), alpha);
  }
`

// --- Puntos de los continentes ---
// uSentimiento[8]: score -1..1 por region de lib/globe/sentimiento.ts (indice 0 sin usar, 1-6
// las regiones de scripts/build-globe-mask.mjs). El resto del globo (aRegion=0) se queda cian.
// Plan 009 §3.2 — version acotada: tiñe por region, sin brillo-por-sesion en el shader (eso
// sigue resuelto con los nodos discretos de NodosSesion.tsx, no punto por punto).
export const puntosVertexShader = /* glsl */ `
  attribute float aBrillo;
  attribute float aFase;
  attribute float aVel;
  attribute float aRegion;
  uniform float uTiempo;
  uniform float uTam;
  uniform vec3 uColor;
  // F0-08 — reveal de entrada: 0..1 que GloboHolografico rampa en 800ms easeOutCubic desde
  // que PuntosTierraCapa asigna la geometria (antes los 36k puntos aparecian de golpe a los
  // 2-5s del muestreo, un pop encima del resto de la coreografia ya asentada).
  uniform float uReveal;
  uniform float uSentimiento[8];
  varying float vBrillo;
  varying float vCara;
  varying float vReveal;
  varying vec3 vColorRegion;

  void main() {
    // El globo es una esfera centrada en el origen: la normal de cada punto es su propia
    // posicion normalizada, no hace falta un atributo "normal" aparte.
    vec3 normal = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDir = normalize(-mvPosition.xyz);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vCara = dot(viewNormal, viewDir);
    vReveal = clamp(uReveal, 0.0, 1.0);

    // F0-07 — amplitud del parpadeo a la mitad (0.25 -> 0.125): el temblor constante de los
    // puntos competia con el mapa de calor de sentimiento en vez de solo darle vida.
    float parpadeo = 0.875 + 0.125 * sin(uTiempo * aVel + aFase);
    vBrillo = aBrillo * parpadeo;

    int region = int(aRegion + 0.5);
    float s = (region > 0 && region < 8) ? uSentimiento[region] : 0.0;
    // Los tonos del mapa de calor YA son los tokens semanticos del repo (GLSL no lee variables
    // CSS, van como literales con el token al lado): tinte hacia --semantic-success /
    // --semantic-danger, nunca mas alla de mezcla (0.65) para no tapar el cian de los puntos.
    vec3 verde = vec3(0.133, 0.773, 0.369); // --semantic-success (#22c55e)
    vec3 rojo = vec3(1.0, 0.231, 0.188); // --semantic-danger (#ff3b30)
    float mezcla = min(abs(s), 1.0) * 0.65;
    vColorRegion = s > 0.0 ? mix(uColor, verde, mezcla) : mix(uColor, rojo, mezcla);

    gl_Position = projectionMatrix * mvPosition;
    // clamp(1.0, 4.5): con uTam=3.4 (el valor anterior) y la camara a z=5.2, esto daba
    // 300/5 * 3.4 ~= 200px POR PUNTO. Con 22k puntos aditivos eso funde todo en una masa
    // blanca solida (la silueta "de nube" era literalmente el contorno del continente
    // muestreado, cada punto gigante tapando al de al lado). Clamp como red de seguridad,
    // uTam bajado aparte — asi un cambio futuro de camara no puede reproducir esto.
    // x vReveal (F0-08): los puntos crecen con el reveal ademas de fundirse via alpha.
    gl_PointSize = clamp(uTam * aBrillo * vReveal * (300.0 / -mvPosition.z), 1.0, 4.5);
  }
`

export const puntosFragmentShader = /* glsl */ `
  varying float vBrillo;
  varying float vCara;
  varying float vReveal;
  varying vec3 vColorRegion;
  void main() {
    // Fuera del reveal no hay nada que dibujar (el clamp de PointSize no baja de 1px, asi
    // que el descarte/gate por alpha es lo que mantiene el punto invisible en 0).
    if (vReveal < 0.003) discard;
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float suavidad = smoothstep(0.5, 0.15, dist);
    float atenuacion = vCara > 0.0 ? 1.0 : 0.25;
    gl_FragColor = vec4(min(vColorRegion * max(vBrillo, 0.0) * atenuacion, vec3(4.0)), clamp(suavidad * atenuacion * vReveal, 0.0, 1.0));
  }
`

// --- Base holografica: anillo plano bajo el globo, brillo radial que pulsa ---
export const baseHologramaVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const baseHologramaFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTiempo;
  uniform float uOpacidad;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - vec2(0.5)) * 2.0;
    float anillo = clamp(smoothstep(1.0, 0.0, d), 0.0, 1.0);
    // F0-07 — el pulso de la base respiraba +-25% (casi un parpadeo): ahora +-7.5%, suficiente
    // para que se sienta viva sin robar atencion a los puntos ni al HUD.
    float pulso = 0.925 + 0.075 * sin(uTiempo * 0.8);
    float alpha = clamp(anillo * anillo * pulso * uOpacidad, 0.0, 1.0);
    gl_FragColor = vec4(min(uColor, vec3(4.0)), alpha);
  }
`
