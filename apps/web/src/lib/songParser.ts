// Parses .txt and .docx files into structured song data.
// Format attendu (txt) :
//   Titre du chant
//   Auteur optionnel
//   [blank line]
//   COUPLET 1 / VERSE 1 / REFRAIN / CHORUS / BRIDGE / INTRO / OUTRO
//   Paroles ligne 1
//   Paroles ligne 2
//   [blank line]
//   REFRAIN
//   ...

/** Limites de l'import en masse. */
export const MAX_IMPORT_FILES = 50
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024 // 2 Mo par fichier (un chant = quelques Ko)

export type ParsedBlock = {
  type: "VERSE" | "CHORUS" | "BRIDGE" | "INTRO" | "OUTRO" | "OTHER"
  label: string
  content: string
  order: number
}

export type ParsedSong = {
  title: string
  artist?: string
  blocks: ParsedBlock[]
}

const BLOCK_TYPE_MAP: Record<string, ParsedBlock["type"]> = {
  VERSE: "VERSE",
  COUPLET: "VERSE",
  CHORUS: "CHORUS",
  REFRAIN: "CHORUS",
  BRIDGE: "BRIDGE",
  INTRO: "INTRO",
  OUTRO: "OUTRO",
}

function detectBlockType(line: string): { type: ParsedBlock["type"]; label: string } | null {
  const upper = line.trim().toUpperCase()
  for (const [key, type] of Object.entries(BLOCK_TYPE_MAP)) {
    // Match exact keyword or keyword followed by optional number (e.g. "VERSE 2", "COUPLET 1")
    if (upper === key || /^\d+$/.test(upper.slice(key.length).trim()) && upper.startsWith(key)) {
      return { type, label: line.trim() }
    }
  }
  return null
}

export function parseSongText(text: string): ParsedSong | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const nonEmpty = lines.findIndex((l) => l.trim())
  if (nonEmpty === -1) return null

  const title = lines[nonEmpty].trim()
  if (!title) return null

  let artist: string | undefined
  let startIdx = nonEmpty + 1

  // L'auteur est sur la ligne immédiatement suivante (pas de ligne vide entre les deux),
  // et ne ressemble pas à un header de bloc. Ensuite doit suivre une ligne vide.
  if (startIdx < lines.length) {
    const nextLine = lines[startIdx].trim()
    const lineAfter = lines[startIdx + 1]?.trim() ?? ""
    if (nextLine && !detectBlockType(nextLine) && lineAfter === "") {
      artist = nextLine
      startIdx += 2
    }
  }

  const blocks: ParsedBlock[] = []
  let currentType: ParsedBlock["type"] = "VERSE"
  let currentLabel = "Couplet"
  let currentLines: string[] = []
  let order = 0

  function flushBlock() {
    const content = currentLines.join("\n").trim()
    if (content) {
      blocks.push({ type: currentType, label: currentLabel, content, order: order++ })
    }
    currentLines = []
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]
    const blockHeader = detectBlockType(line)
    if (blockHeader) {
      flushBlock()
      currentType = blockHeader.type
      currentLabel = blockHeader.label
    } else {
      currentLines.push(line)
    }
  }
  flushBlock()

  if (blocks.length === 0) {
    // Pas de structure détectée — tout en un seul bloc VERSE
    const content = lines.slice(startIdx).join("\n").trim()
    if (content) blocks.push({ type: "VERSE", label: "Couplet 1", content, order: 0 })
  }

  return blocks.length > 0 ? { title, artist, blocks } : null
}

export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}
