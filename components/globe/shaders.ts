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
  uniform float uSentimiento[8];
  varying float vBrillo;
  varying float vCara;
  varying vec3 vColorRegion;

  void main() {
    // El globo es una esfera centrada en el origen: la normal de cada punto es su propia
    // posicion normalizada, no hace falta un atributo "normal" aparte.
    vec3 normal = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDir = normalize(-mvPosition.xyz);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vCara = dot(viewNormal, viewDir);

    float parpadeo = 0.75 + 0.25 * sin(uTiempo * aVel + aFase);
    vBrillo = aBrillo * parpadeo;

    int region = int(aRegion + 0.5);
    float s = (region > 0 && region < 8) ? uSentimiento[region] : 0.0;
    vec3 verde = vec3(0.133, 0.773, 0.369);
    vec3 rojo = vec3(1.0, 0.231, 0.188);
    float mezcla = min(abs(s), 1.0) * 0.65;
    vColorRegion = s > 0.0 ? mix(uColor, verde, mezcla) : mix(uColor, rojo, mezcla);

    gl_Position = projectionMatrix * mvPosition;
    // clamp(1.0, 4.5): con uTam=3.4 (el valor anterior) y la camara a z=5.2, esto daba
    // 300/5 * 3.4 ~= 200px POR PUNTO. Con 22k puntos aditivos eso funde todo en una masa
    // blanca solida (la silueta "de nube" era literalmente el contorno del continente
    // muestreado, cada punto gigante tapando al de al lado). Clamp como red de seguridad,
    // uTam bajado aparte — asi un cambio futuro de camara no puede reproducir esto.
    gl_PointSize = clamp(uTam * aBrillo * (300.0 / -mvPosition.z), 1.0, 4.5);
  }
`

export const puntosFragmentShader = /* glsl */ `
  varying float vBrillo;
  varying float vCara;
  varying vec3 vColorRegion;
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float suavidad = smoothstep(0.5, 0.15, dist);
    float atenuacion = vCara > 0.0 ? 1.0 : 0.25;
    gl_FragColor = vec4(min(vColorRegion * max(vBrillo, 0.0) * atenuacion, vec3(4.0)), clamp(suavidad * atenuacion, 0.0, 1.0));
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
    float pulso = 0.75 + 0.25 * sin(uTiempo * 0.8);
    float alpha = clamp(anillo * anillo * pulso * uOpacidad, 0.0, 1.0);
    gl_FragColor = vec4(min(uColor, vec3(4.0)), alpha);
  }
`
