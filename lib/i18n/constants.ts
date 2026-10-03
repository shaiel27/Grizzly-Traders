// Shared between server (lib/i18n/server.ts) and client (lib/i18n/LocaleProvider.tsx) code,
// so it must never import next/headers or any server-only module.
export const LOCALE_COOKIE = 'gt_locale'
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year
