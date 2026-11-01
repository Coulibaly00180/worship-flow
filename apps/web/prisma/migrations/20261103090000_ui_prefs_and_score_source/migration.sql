-- Réglages d'apparence synchronisés entre appareils
ALTER TABLE "User" ADD COLUMN "uiPrefs" TEXT;

-- Partitions saisies en YAML (solfège) : on conserve la source en plus de l'ABC compilé
ALTER TABLE "SongScore" ADD COLUMN "source" TEXT;
