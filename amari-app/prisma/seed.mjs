import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      displayName: "Administrator",
      email: "admin@amarijewels.local",
      mobile: "9999999999",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
    },
  });

  const categories = [
    ["CAT-000001", "Ring"],
    ["CAT-000002", "Necklace"],
    ["CAT-000003", "Earrings"],
    ["CAT-000004", "Bracelet"],
    ["CAT-000005", "Pendant"],
  ];

  for (const [code, name] of categories) {
    await prisma.category.upsert({
      where: { code },
      update: {},
      create: { code, name, status: "ACTIVE" },
    });
  }

  const ring = await prisma.category.findUnique({ where: { code: "CAT-000001" } });
  if (ring) {
    await prisma.subCategory.upsert({
      where: { code: "SUB-000001" },
      update: {},
      create: {
        categoryId: ring.id,
        code: "SUB-000001",
        name: "Engagement Ring",
        status: "ACTIVE",
      },
    });
  }

  const profile = await prisma.businessProfile.findFirst();
  if (!profile) {
    await prisma.businessProfile.create({
      data: {
        businessName: "Amari Jewels",
        ownerName: "Owner",
        country: "India",
      },
    });
  }

  console.log(`Seeded admin user ${admin.username} with password admin123`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
