/**
 * Stockage du contenu des partitions PDF/PNG/JPEG.
 *
 * - Par défaut : dans PostgreSQL (colonne SongScore.data). Simple, rien à configurer, mais la base
 *   et ses sauvegardes grossissent avec chaque fichier (jusqu'à 8 Mo).
 * - Si S3_BUCKET est défini : dans un stockage objet compatible S3 (AWS S3, Cloudflare R2, MinIO,
 *   Scaleway…). La base ne garde que la clé (SongScore.storageKey).
 *
 * Les deux coexistent : les partitions déjà en base restent lisibles après activation de S3
 * (voir `npm run scores:to-s3` pour les y déplacer).
 */
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"

export type S3Settings = {
  bucket: string
  region: string
  endpoint?: string
  forcePathStyle: boolean
  prefix: string
}

export function s3Settings(env: NodeJS.ProcessEnv = process.env): S3Settings | null {
  const bucket = env.S3_BUCKET?.trim()
  if (!bucket) return null
  return {
    bucket,
    region: env.S3_REGION?.trim() || "auto",
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    prefix: (env.S3_PREFIX?.trim() || "scores").replace(/^\/+|\/+$/g, ""),
  }
}

let client: S3Client | undefined
let clientFor: string | undefined

function s3(settings: S3Settings): S3Client {
  const id = JSON.stringify(settings)
  if (!client || clientFor !== id) {
    // Identifiants : S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY, sinon la chaîne standard AWS (rôle IAM…)
    const accessKeyId = process.env.S3_ACCESS_KEY_ID
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
    client = new S3Client({
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: settings.forcePathStyle,
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    })
    clientFor = id
  }
  return client
}

/** Le stockage objet est-il configuré ? */
export function objectStorageEnabled(): boolean {
  return s3Settings() !== null
}

/** Clé d'objet : jamais dérivée du nom de fichier fourni par l'utilisateur. */
export function newScoreKey(songId: string, prefix = s3Settings()?.prefix ?? "scores"): string {
  return `${prefix}/${songId.replace(/[^a-zA-Z0-9_-]/g, "")}/${randomUUID()}`
}

export async function putScoreObject(key: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  const settings = s3Settings()
  if (!settings) throw new Error("Stockage objet non configuré (S3_BUCKET)")
  await s3(settings).send(
    new PutObjectCommand({ Bucket: settings.bucket, Key: key, Body: bytes, ContentType: mimeType, ContentLength: bytes.length }),
  )
}

/** Flux du contenu, ou null si l'objet n'existe pas. */
export async function getScoreObject(key: string): Promise<ReadableStream | null> {
  const settings = s3Settings()
  if (!settings) throw new Error("Stockage objet non configuré (S3_BUCKET)")
  try {
    const out = await s3(settings).send(new GetObjectCommand({ Bucket: settings.bucket, Key: key }))
    return out.Body ? (out.Body.transformToWebStream() as ReadableStream) : null
  } catch (err) {
    const name = (err as { name?: string }).name
    if (name === "NoSuchKey" || name === "NotFound") return null
    throw err
  }
}

/** Suppression « au mieux » : une erreur est journalisée, jamais remontée à l'utilisateur. */
export async function deleteScoreObject(key: string): Promise<void> {
  const settings = s3Settings()
  if (!settings) return
  try {
    await s3(settings).send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }))
  } catch (err) {
    console.error(`[scores] suppression de l'objet ${key} impossible`, err)
  }
}
