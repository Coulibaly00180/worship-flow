-- Durcissement : unicité limitée aux lignes non supprimées, tags en tableau, préférences en JSONB,
-- version de session, limitation des connexions partagée, stockage objet des partitions,
-- suppression des colonnes héritées jamais utilisées.

-- Conversion tolérante texte → JSONB (valeur illisible → NULL au lieu de faire échouer la migration)
CREATE OR REPLACE FUNCTION pg_temp.try_jsonb(t TEXT) RETURNS JSONB AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ── Unicité : seuls les chants / plans non supprimés comptent ───────────────
DROP INDEX "Song_title_key";
CREATE UNIQUE INDEX "Song_title_active_key" ON "Song"("title") WHERE "deletedAt" IS NULL;
CREATE INDEX "Song_title_idx" ON "Song"("title");

DROP INDEX "ServicePlan_date_key";
CREATE UNIQUE INDEX "ServicePlan_date_active_key" ON "ServicePlan"("date") WHERE "deletedAt" IS NULL;
CREATE INDEX "ServicePlan_date_idx" ON "ServicePlan"("date");

-- ── Song.tags : texte JSON → TEXT[] ─────────────────────────────────────────
ALTER TABLE "Song" ADD COLUMN "tags_new" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Song" s SET "tags_new" = COALESCE(
  (
    SELECT array_agg(btrim(e)) FILTER (WHERE btrim(e) <> '')
    FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(pg_temp.try_jsonb(s."tags")) = 'array' THEN pg_temp.try_jsonb(s."tags") ELSE '[]'::jsonb END
    ) AS e
  ),
  ARRAY[]::TEXT[]
);
ALTER TABLE "Song" DROP COLUMN "tags";
ALTER TABLE "Song" RENAME COLUMN "tags_new" TO "tags";

-- ── User : préférences en JSONB + version de session ────────────────────────
ALTER TABLE "User" ADD COLUMN "uiPrefs_new" JSONB;
UPDATE "User" SET "uiPrefs_new" = pg_temp.try_jsonb("uiPrefs");
ALTER TABLE "User" DROP COLUMN "uiPrefs";
ALTER TABLE "User" RENAME COLUMN "uiPrefs_new" TO "uiPrefs";
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ALTER COLUMN "username" DROP DEFAULT;

-- ── Partitions : clé dans un stockage objet (S3 compatible), sinon contenu en base ──
ALTER TABLE "SongScore" ADD COLUMN "storageKey" TEXT;

-- ── Colonnes héritées (jamais alimentées par l'interface) ───────────────────
ALTER TABLE "ServiceItem"
  DROP COLUMN "backgroundConfig",
  DROP COLUMN "mediaPath",
  DROP COLUMN "refId",
  DROP COLUMN "refSubId",
  DROP COLUMN "secondaryContent";
ALTER TABLE "ServicePlan" DROP COLUMN "backgroundConfig";

-- ── Limitation des tentatives de connexion (partagée entre instances) ───────
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "LoginThrottle_updatedAt_idx" ON "LoginThrottle"("updatedAt");
