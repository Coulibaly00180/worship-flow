import { describe, it, expect } from "vitest"
import { newScoreKey, s3Settings } from "./scoreStorage"

describe("scoreStorage", () => {
  it("désactivé sans S3_BUCKET", () => {
    expect(s3Settings({} as NodeJS.ProcessEnv)).toBeNull()
  })
  it("lit la configuration (R2 / MinIO)", () => {
    expect(
      s3Settings({ S3_BUCKET: "wf", S3_ENDPOINT: "http://minio:9000", S3_FORCE_PATH_STYLE: "true", S3_PREFIX: "/p/" } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ bucket: "wf", region: "auto", endpoint: "http://minio:9000", forcePathStyle: true, prefix: "p" })
  })
  it("génère une clé qui ne dépend pas du nom de fichier", () => {
    const key = newScoreKey("song/../1", "scores")
    expect(key).toMatch(/^scores\/song1\/[0-9a-f-]{36}$/)
  })
})
