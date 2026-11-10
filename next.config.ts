import type { NextConfig } from "next";

// En dev, Next.js/React usan `eval` para reconstruir stack traces del servidor en el
// navegador (ver node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// sección "Development vs Production Considerations"). Sin 'unsafe-eval' ahí, el overlay de
// errores y el refresco en caliente se rompen. No se usa en producción (ni Next ni React
// usan eval en build de producción por defecto).
const isDev = process.env.NODE_ENV === "development";

// Google Analytics: sus dominios solo entran en la política de seguridad si hay un ID de medición válido (se fija al compilar)
const gaActivo = /^G-[A-Z0-9]{6,14}$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "");
const gaScripts = gaActivo ? " https://www.googletagmanager.com" : "";
const gaConexiones = gaActivo ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : "";
const gaImagenes = gaActivo ? " https://*.google-analytics.com https://*.googletagmanager.com" : "";

// Publicidad (Adsterra): con ella activada, las páginas de ARTÍCULO, el LISTADO de artículos y las herramientas con anuncios laterales (calendario y pivots) llevan una política de seguridad que admite los servidores de los anuncios
// (los de NEXT_PUBLIC_ADS_SLOTS y NEXT_PUBLIC_ADS_HOSTS). El resto del sitio conserva la política estricta. Sin publicidad activa, nada cambia.
const hostValido = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const adsActiva = process.env.NEXT_PUBLIC_ADS_ACTIVO === "true";
const adsHosts: string[] = (() => {
  if (!adsActiva) return [];
  const hosts = (process.env.NEXT_PUBLIC_ADS_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase());
  try {
    const slots = JSON.parse(process.env.NEXT_PUBLIC_ADS_SLOTS ?? "{}") as Record<string, { host?: string }>;
    for (const s of Object.values(slots)) if (typeof s?.host === "string") hosts.push(s.host.toLowerCase());
  } catch {
    // JSON ilegible: lib/publicidad.ts también lo ignora (sin espacios no hay anuncios)
  }
  return [...new Set(hosts.filter((h) => hostValido.test(h)))].map((h) => `https://${h}`);
})();
const ads = adsHosts.length ? ` ${adsHosts.join(" ")}` : "";

const cspDirectivas = (extra: { script: string; img: string; connect: string; frame: string }) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://s3.tradingview.com${gaScripts}${extra.script}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://pudzvatuubywmwdmboiq.supabase.co https://coin-images.coingecko.com${gaImagenes}${extra.img}`,
    "font-src 'self'",
    `connect-src 'self' https://pudzvatuubywmwdmboiq.supabase.co https://*.supabase.co wss://*.supabase.co${gaConexiones}${extra.connect}`,
    "worker-src 'self' blob:",
    // Widget Advanced Chart de TradingView (components/ui/TradingViewWidget.tsx): el script oficial
    // viene de s3.tradingview.com (script-src) y crea un iframe de www.tradingview-widget.com.
    // Sin comodines.
    `frame-src https://www.tradingview-widget.com${extra.frame}`,
    "frame-ancestors 'none'",
    "base-uri 'self'; form-action 'self'",
  ].join("; ");

const sinCsp = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const csp = (value: string) => ({ key: "Content-Security-Policy", value });
const cspEstricta = csp(cspDirectivas({ script: "", img: "", connect: "", frame: "" }));
const cspConAnuncios = csp(cspDirectivas({ script: ads, img: ads, connect: ads, frame: ads }));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Solo importa en dev: permite que el websocket de HMR (/_next/hmr) conteste pedidos de un
  // tunel de Cloudflare (cloudflared tunnel --url), que sirve el sitio desde un host *.trycloudflare.com
  // en vez de localhost. Sin esto, Next bloquea esos pedidos cross-origin por seguridad (ver
  // node_modules/next/dist/docs/.../allowedDevOrigins.md) y el globo (que depende del chunk
  // cargado por HMR) se queda sin terminar de cargar al entrar por el tunel — el log mostraba
  // "Blocked cross-origin request to Next.js dev resource /_next/hmr" seguido de cloudflared
  // reportando la respuesta como "malformed... Unauthorized", que es la consecuencia, no la
  // causa. `*.trycloudflare.com` (un solo nivel de subdominio) cubre cualquier tunel nuevo:
  // cloudflared genera un subdominio al azar cada vez que se corre `tunnel --url`, nunca el
  // mismo dos veces, asi que el host especifico del log (assets-opt-snowboard-mini...) habria
  // dejado de servir apenas se reinicie el tunel.
  ...(isDev ? { allowedDevOrigins: ["*.trycloudflare.com"] } : {}),
  // 404 global sin layouts (ver app/global-not-found.tsx): el sitio tiene varios layouts raíz y un segmento [locale] arriba
  experimental: {
    globalNotFound: true,
  },
  images: {
    // Las URL de portada llevan el id del post o un hash: no cambian. Una semana de caché en el optimizador evita
    // recalcular las variantes (el VPS comparte CPU con n8n).
    minimumCacheTTL: 60 * 60 * 24 * 7,
    qualities: [75],
    // Solo los anchos que de verdad se piden (tarjetas ~380 px, portada del artículo 896 px, iconos y avatares): menos
    // variantes distintas por imagen = menos CPU y menos disco
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [48, 96, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pudzvatuubywmwdmboiq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        pathname: "/coins/images/**",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: sinCsp },
      // Sin publicidad (o sin servidores de anuncios configurados): la política estricta en todas partes, como siempre.
      // Con ella: solo las páginas de artículo admiten los servidores de los anuncios; el resto sigue estricto.
      ...(adsHosts.length
        ? [
            // Páginas con anuncios: el listado de artículos (/articulos) y cada artículo (/articulos/<slug>)
            { source: "/articulos", headers: [cspConAnuncios] },
            { source: "/articulos/:slug", headers: [cspConAnuncios] },
            // Herramientas con columnas de publicidad a los lados
            { source: "/calendario", headers: [cspConAnuncios] },
            { source: "/pivot-points", headers: [cspConAnuncios] },
            { source: "/((?!(?:articulos(?:/[^/]+)?|calendario|pivot-points)$).*)", headers: [cspEstricta] },
          ]
        : [{ source: "/:path*", headers: [cspEstricta] }]),
      // Texturas del globo y fuente de iconos: no cambian entre despliegues salvo a mano, una semana basta
      { source: "/globo/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
