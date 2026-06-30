import { PrismaClient, Role } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await hash("Admin@123", 12) // cost factor 12 per T-1-04 mitigation

  const manager = await prisma.user.upsert({
    where: { email: "admin@logistics.com" },
    update: {},
    create: {
      email: "admin@logistics.com",
      name: "System Administrator",
      passwordHash,
      role: Role.MANAGER,
      isActive: true,
    },
  })

  console.log(`Seeded manager: ${manager.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
