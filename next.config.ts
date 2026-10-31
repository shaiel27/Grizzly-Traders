import type { NextConfig } from "next";

// En dev, Next.js/React usan `eval` para reconstruir stack traces del servidor en el
// navegador (ver node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// sección "Development vs Production Considerations"). Sin 'unsafe-eval' ahí, el overlay de
// errores y el refresco en caliente se rompen. No se usa en producción (ni Next ni React
// usan eval en build de producción por defecto).
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://s3.tradingview.com${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://pudzvatuubywmwdmboiq.supabase.co https://coin-images.coingecko.com",
      "font-src 'self'",
      "connect-src 'self' https://pudzvatuubywmwdmboiq.supabase.co https://*.supabase.co wss://*.supabase.co",
      "worker-src 'self' blob:",
      // Widget Advanced Chart de TradingView (components/ui/TradingViewWidget.tsx): el script oficial
      // viene de s3.tradingview.com (script-src) y crea un iframe de www.tradingview-widget.com.
      // Sin comodines.
      "frame-src https://www.tradingview-widget.com",
      "frame-ancestors 'none'",
      "base-uri 'self'; form-action 'self'",
    ].join("; "),
  },
];

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
      { source: "/:path*", headers: securityHeaders },
      // Texturas del globo y fuente de iconos: no cambian entre despliegues salvo a mano, una semana basta
      { source: "/globo/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
