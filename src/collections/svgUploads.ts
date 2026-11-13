import { createReadStream } from 'node:fs'
import sax from 'sax'

export function declaresSvg(name: string, mimeType?: string) {
  const filename = name.replace(/[\x00-\x1f\x80-\x9f]/g, '').split(/[?#]/, 1)[0].trim()
  return /\.svgz?$/i.test(filename) || mimeType?.split(';', 1)[0].trim().toLowerCase() === 'image/svg+xml'
}

function decoderFor(bytes: Buffer) {
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || bytes[1] === 0) return new TextDecoder('utf-16le')
  if ((bytes[0] === 0xfe && bytes[1] === 0xff) || bytes[0] === 0) return new TextDecoder('utf-16be')
  return new TextDecoder('utf-8')
}

/** Identify the XML root, without rendering SVG, resolving entities, or attempting to sanitize it. */
export async function hasSvgRoot(source: Buffer | string): Promise<boolean> {
  const stop = Symbol('root inspected')
  const parser = sax.parser(true)
  let svg = false
  let markup = false
  let decoder: TextDecoder | undefined
  parser.onopentagstart = ({ name }) => {
    svg = name.split(':').at(-1)?.toLowerCase() === 'svg'
    throw stop
  }
  // A parser limit/error before the root is known must not turn an XML-looking file
  // into an accepted text upload (for example, SVG after a very long comment).
  parser.onerror = (error) => { throw error }
  function inspect(text: string) {
    if (!markup) {
      const first = text.match(/\S/)
      if (!first) return
      if (first[0] !== '<') throw stop
      markup = true
    }
    parser.write(text)
  }
  // Stream both sources so a long XML comment cannot bypass a fixed-size prefix check.
  const chunks = typeof source === 'string' ? createReadStream(source, { highWaterMark: 64 * 1024 }) : (function* () {
    for (let offset = 0; offset < source.length; offset += 64 * 1024) yield source.subarray(offset, offset + 64 * 1024)
  })()
  try {
    for await (const chunk of chunks) {
      const bytes = chunk as Buffer
      decoder ??= decoderFor(bytes)
      inspect(decoder.decode(bytes, { stream: true }))
    }
    if (decoder) inspect(decoder.decode())
    if (markup) parser.close()
  } catch (error) {
    if (error !== stop) throw error
  }
  return svg
}

export function uploadedFileHeaders({ headers }: { headers: Headers }) {
  headers.set('X-Content-Type-Options', 'nosniff')
  return headers
}
