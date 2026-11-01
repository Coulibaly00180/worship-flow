import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../src/generated/prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] }),
})

async function main() {
  const email     = process.env["ADMIN_EMAIL"]
  const password  = process.env["ADMIN_PASSWORD"]
  const firstName = process.env["ADMIN_FIRST_NAME"] ?? "Admin"
  const lastName  = process.env["ADMIN_LAST_NAME"]  ?? ""
  const username  = process.env["ADMIN_USERNAME"]   ?? "admin"

  if (!email || !password) {
    console.error("Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx prisma/seed/seed-admin.ts")
    process.exit(1)
  }

  const [byEmail, byUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ])

  if (byEmail) {
    console.log(`Admin déjà existant : ${email}`)
    return
  }
  if (byUsername) {
    console.error(`Le pseudo "${username}" est déjà pris. Définir ADMIN_USERNAME.`)
    process.exit(1)
  }

  const passwordHash = await hash(password, 12)
  const fullName = `${firstName} ${lastName}`.trim()

  const admin = await prisma.user.create({
    data: {
      firstName,
      lastName,
      username,
      name: fullName,
      email,
      passwordHash,
      role: "ADMIN",
    },
  })

  console.log(`✓ Admin créé : ${admin.email} | pseudo : ${admin.username} | id : ${admin.id}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
