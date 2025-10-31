import pkg from "@prisma/client";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { PrismaClient } = pkg;
const seedDir = path.dirname(fileURLToPath(import.meta.url));
const fallbackDatabaseUrl = pathToFileURL(path.join(seedDir, "dev.db")).toString();
const databaseUrl = process.env.DATABASE_URL ?? fallbackDatabaseUrl;
process.env.DATABASE_URL = databaseUrl;
const prisma = new PrismaClient();

const demoSpaces = [
  {
    name: "Alpha Space",
    description: "A calm sandbox to explore the dashboard.",
    inviteCode: "alpha-invite",
    joinCode: "alpha-space",
    mode: "demo",
  },
  {
    name: "Beta Space",
    description: "A second space for testing the join flow.",
    inviteCode: "beta-invite",
    joinCode: "beta-space",
    mode: "demo",
  },
];

async function main() {
  console.log("🌱 Preparing demo spaces for GiftLink...");

  const confirmedSpaces = [];

  for (const spaceData of demoSpaces) {
    const space = await prisma.space.upsert({
      where: { joinCode: spaceData.joinCode },
      update: {
        name: spaceData.name,
        description: spaceData.description,
        inviteCode: spaceData.inviteCode,
        mode: spaceData.mode,
      },
      create: {
        ...spaceData,
      },
    });

    confirmedSpaces.push(space);
  }

  console.log("✨ Demo spaces ready. Join codes:");
  for (const space of confirmedSpaces) {
    console.log(`• ${space.name} → "${space.joinCode}"`);
  }

  await prisma.reward.deleteMany({
    where: { spaceId: { in: confirmedSpaces.map((space) => space.id) } },
  });

  const demoRewards = [];
  for (const space of confirmedSpaces) {
    demoRewards.push(
      prisma.reward.create({
        data: {
          spaceId: space.id,
          ownerKey: "demo-owner",
          title: "Breakfast in bed",
          points: 40,
          description: "Surprise your partner with a calm morning tray.",
        },
      }),
      prisma.reward.create({
        data: {
          spaceId: space.id,
          ownerKey: "demo-partner",
          title: "Movie night pick",
          points: 25,
          description: "Winner controls the remote and the snacks.",
        },
      }),
    );
  }

  await Promise.all(demoRewards);

  console.log("🤝 Re-run this seed anytime for a fresh-yet-familiar test bed.");
}

main()
  .catch((error) => {
    console.error("Seed did not complete. Details:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
