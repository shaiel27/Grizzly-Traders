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
      "img-src 'self' data: blob: https://pudzvatuubywmwdmboiq.supabase.co",
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pudzvatuubywmwdmboiq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
