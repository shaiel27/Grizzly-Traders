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
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://pudzvatuubywmwdmboiq.supabase.co https://coin-images.coingecko.com",
      "font-src 'self'",
      "connect-src 'self' https://pudzvatuubywmwdmboiq.supabase.co https://*.supabase.co wss://*.supabase.co",
      "worker-src 'self' blob:",
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
  images: {
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
