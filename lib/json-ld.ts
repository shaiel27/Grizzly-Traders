// Escapes '<' so a value can never close the surrounding <script> tag.
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
