// Utilidades del editor visual del CMS sobre el HTML del artículo (sin DOM: se prueban en Node).

// El editor visual solo conoce párrafos, títulos h2/h3, negrita, cursiva, subrayado, listas, citas, código, enlaces e
// imágenes. Si el HTML trae otra cosa (tablas, h1/h4+, div, span, sup/sub…), abrirlo en el editor visual la perdería
// al guardar, así que ese texto se edita en HTML.
const UNSUPPORTED = /<\/?(table|thead|tbody|tfoot|tr|td|th|div|span|sup|sub|s|h1|h4|h5|h6|iframe|video|audio|script|style)\b/i

export function needsSourceMode(html: string): boolean {
  return UNSUPPORTED.test(html)
}

// TipTap devuelve `<p></p>` para un documento vacío: el formulario lo trata como vacío
export function normalizeEditorHtml(html: string): string {
  // TipTap deja siempre un párrafo vacío al final (para poder seguir escribiendo debajo de una imagen o un título):
  // no se guarda con el artículo
  const trimmed = html.replace(/(?:<p>\s*<\/p>\s*)+$/i, '')
  return trimmed.replace(/\s+/g, '') === '' ? '' : trimmed
}

const FIGURE = /<figure\b[\s\S]*?<\/figure>/gi
const SRC = /<img\b[^>]*\bsrc="([^"]+)"/i

export function figuresOf(html: string): { src: string; html: string }[] {
  return (html.match(FIGURE) ?? []).flatMap((figure) => {
    const src = SRC.exec(figure)?.[1]
    return src ? [{ src, html: figure }] : []
  })
}

// Copia al final de `target` las figuras de `source` que aún no están (se comparan por URL de la imagen). El autor
// las coloca donde quiera: el orden de los párrafos es distinto en cada idioma.
export function copyFigures(source: string, target: string): { html: string; added: number } {
  const present = new Set(figuresOf(target).map((figure) => figure.src))
  const missing = figuresOf(source).filter((figure) => !present.has(figure.src))
  if (missing.length === 0) return { html: target, added: 0 }
  return { html: `${target}${missing.map((figure) => figure.html).join('')}`, added: missing.length }
}

export function countImagesWithoutAlt(html: string): number {
  const images = html.match(/<img\b[^>]*>/gi) ?? []
  // Un alt vacío o de solo espacios cuenta como ausente (ojo: `\S` también casaría con la comilla de cierre)
  return images.filter((tag) => !/\balt="[^"]*[^"\s][^"]*"/i.test(tag)).length
}
