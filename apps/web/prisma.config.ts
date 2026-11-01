// Import de type uniquement (effacé à l'exécution) : le fichier doit rester chargeable
// par la CLI Prisma installée globalement dans l'image Docker de production.
import type { PrismaConfig } from "prisma/config"

// Prisma 7 ne charge plus les fichiers .env automatiquement.
// En local on lit .env.local puis .env ; en Docker/CI les variables sont déjà dans l'environnement.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file)
  } catch {
    // fichier absent : ignoré
  }
}

const config: PrismaConfig = {
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Pas de env() : `prisma generate` ne doit pas échouer quand la variable est absente (build, CI).
    url: process.env.DATABASE_URL ?? "",
  },
}

export default config
