import { figuresOf } from './rich-html'

// Cuerpo del modo asistido: el editor visual produce HTML con <figure> para cada imagen. A GPT no se le pasan las
// imágenes (podría perderlas, moverlas o alterar una URL): se sustituyen por marcadores `[[IMG:n]]`, cada uno en su
// párrafo, y los datos de cada imagen viajan aparte. El flujo de n8n vuelve a poner las figuras en su lugar.

export const MAX_BRIEF_IMAGES = 10

export interface BriefImage {
  n: number
  url: string
  alt: string
  caption: string
  width?: number
  height?: number
}

export interface BriefPayload {
  cuerpo: string
  imagenes: BriefImage[]
}

const TOKEN = /\[\[IMG:\d+\]\]/g

function attr(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(tag)
  return match ? decode(match[1]) : ''
}

function decode(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

// Texto visible del cuerpo, sin etiquetas ni marcadores: es lo que cuenta para el mínimo de caracteres
export function briefTextLength(html: string): number {
  return decode(html.replace(TOKEN, ' ').replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '))
    .replace(/\s+/g, ' ')
    .trim().length
}

export function briefToPayload(html: string): BriefPayload {
  const imagenes: BriefImage[] = []
  let cuerpo = html
  for (const figure of figuresOf(html).slice(0, MAX_BRIEF_IMAGES)) {
    const img = /<img\b[^>]*>/i.exec(figure.html)?.[0] ?? ''
    const caption = /<figcaption>([\s\S]*?)<\/figcaption>/i.exec(figure.html)?.[1] ?? ''
    const n = imagenes.length + 1
    const width = Number(attr(img, 'width'))
    const height = Number(attr(img, 'height'))
    imagenes.push({
      n,
      url: figure.src,
      alt: attr(img, 'alt'),
      caption: decode(caption.replace(/<[^>]*>/g, '')),
      ...(width > 0 ? { width } : {}),
      ...(height > 0 ? { height } : {}),
    })
    cuerpo = cuerpo.replace(figure.html, `<p>[[IMG:${n}]]</p>`)
  }
  // Más figuras de las permitidas: se quitan (el formulario avisa antes de llegar aquí)
  cuerpo = cuerpo.replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
  return { cuerpo, imagenes }
}

// Palabras del texto visible (para el contador del editor)
export function briefWordCount(html: string): number {
  const text = decode(html.replace(TOKEN, ' ').replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ').replace(/<\/(p|h[1-6]|li|blockquote)>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')).trim()
  return text ? text.split(/\s+/).length : 0
}

// Cuántas imágenes lleva el cuerpo del editor (para avisar si pasa del tope)
export function briefImageCount(html: string): number {
  return figuresOf(html).length
}
