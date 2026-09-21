// Builds a tiny self-hosted Material Symbols font that contains only the icons the code uses.
// Run `pnpm icons` after adding a new icon name anywhere in app/, components/ or lib/.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE_DIRS = ['app', 'components', 'lib']
const OUTPUT = path.join(ROOT, 'public', 'fonts', 'material-symbols.woff2')
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : []
    })
  )
  return files.flat()
}

async function officialIconNames() {
  const response = await fetch('https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true')
  if (!response.ok) throw new Error(`Icon metadata request failed: ${response.status}`)
  const text = (await response.text()).replace(/^\)\]\}'\n/, '')
  return new Set(JSON.parse(text).icons.map((icon) => icon.name))
}

const files = (await Promise.all(SOURCE_DIRS.map((dir) => walk(path.join(ROOT, dir))))).flat()
const literals = new Set()
for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/(['"`>])\s*([a-z][a-z0-9_]{1,40})\s*(?=['"`<])/g)) literals.add(match[2])
}

// Any snake_case word that is also an official icon name is included; extras only cost a few bytes.
const official = await officialIconNames()
const icons = [...literals].filter((name) => official.has(name)).sort()
console.log(`${icons.length} icons: ${icons.join(', ')}`)

const cssUrl =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0' +
  `&icon_names=${icons.join(',')}&display=block`
const cssResponse = await fetch(cssUrl, { headers: { 'User-Agent': USER_AGENT } })
if (!cssResponse.ok) throw new Error(`Font CSS request failed: ${cssResponse.status}`)

const fontUrl = (await cssResponse.text()).match(/url\((https:[^)]+)\) format\('woff2'\)/)?.[1]
if (!fontUrl) throw new Error('No woff2 URL found in the font CSS')

const fontResponse = await fetch(fontUrl)
if (!fontResponse.ok) throw new Error(`Font download failed: ${fontResponse.status}`)
const bytes = Buffer.from(await fontResponse.arrayBuffer())

await mkdir(path.dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, bytes)
console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${(bytes.length / 1024).toFixed(1)} KB)`)
