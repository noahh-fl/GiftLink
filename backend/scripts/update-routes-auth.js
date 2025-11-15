#!/usr/bin/env node
/**
 * Script to update all routes in server.js with JWT authentication
 * This replaces the old header-based auth with proper JWT middleware
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PATH = path.join(__dirname, '..', 'server.js');

function updateServerJS() {
  console.log('📝 Reading server.js...');
  let content = fs.readFileSync(SERVER_PATH, 'utf-8');

  // 1. Add import for spaceHelpers
  if (!content.includes('import { isSpaceMember')) {
    console.log('✅ Adding spaceHelpers import...');
    content = content.replace(
      'import { requireAuth, requireSpaceMembership, requireSpaceOwnership } from "./middleware/auth.js";',
      'import { requireAuth, requireSpaceMembership, requireSpaceOwnership } from "./middleware/auth.js";\n' +
      'import { isSpaceMember, addSpaceMember } from "./lib/spaceHelpers.js";'
    );
  }

  // 2. Update route definitions to add authentication middleware
  const routeUpdates = [
    // Space routes that need requireAuth only
    {
      pattern: /app\.post\("\/space",\s*async/g,
      replacement: 'app.post("/space", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/spaces",\s*async/g,
      replacement: 'app.post("/spaces", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.get\("\/spaces",\s*async/g,
      replacement: 'app.get("/spaces", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/spaces\/join",\s*async/g,
      replacement: 'app.post("/spaces/join", { preHandler: requireAuth }, async'
    },

    // Space routes that need requireAuth + requireSpaceMembership
    {
      pattern: /app\.get\("\/spaces\/:id",\s*async/g,
      replacement: 'app.get("/spaces/:id", { preHandler: [requireAuth, requireSpaceMembership] }, async'
    },

    // Space routes that need requireAuth + requireSpaceOwnership
    {
      pattern: /app\.patch\("\/spaces\/:id",\s*async/g,
      replacement: 'app.patch("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] }, async'
    },
    {
      pattern: /app\.delete\("\/spaces\/:id",\s*async/g,
      replacement: 'app.delete("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] }, async'
    },
    {
      pattern: /app\.get\("\/spaces\/:id\/code",\s*async/g,
      replacement: 'app.get("/spaces/:id/code", { preHandler: [requireAuth, requireSpaceOwnership] }, async'
    },
    {
      pattern: /app\.post\("\/spaces\/:id\/code\/rotate",\s*async/g,
      replacement: 'app.post("/spaces/:id/code/rotate", { preHandler: [requireAuth, requireSpaceOwnership] }, async'
    },

    // Wishlist routes
    {
      pattern: /app\.get\("\/wishlist",\s*async/g,
      replacement: 'app.get("/wishlist", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/wishlist",\s*async/g,
      replacement: 'app.post("/wishlist", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.patch\("\/wishlist\/:id",\s*async/g,
      replacement: 'app.patch("/wishlist/:id", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.delete\("\/wishlist\/:id",\s*async/g,
      replacement: 'app.delete("/wishlist/:id", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/wishlist\/bulk-archive",\s*async/g,
      replacement: 'app.post("/wishlist/bulk-archive", { preHandler: requireAuth }, async'
    },

    // Gift routes
    {
      pattern: /app\.post\("\/spaces\/:id\/gifts",\s*async/g,
      replacement: 'app.post("/spaces/:id/gifts", { preHandler: [requireAuth, requireSpaceMembership] }, async'
    },
    {
      pattern: /app\.post\("\/gift\/:id\/reserve",\s*async/g,
      replacement: 'app.post("/gift/:id/reserve", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/gift\/:id\/unreserve",\s*async/g,
      replacement: 'app.post("/gift/:id/unreserve", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/gift\/:id\/purchase",\s*async/g,
      replacement: 'app.post("/gift/:id/purchase", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/gift\/:id\/deliver",\s*async/g,
      replacement: 'app.post("/gift/:id/deliver", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/gift\/:id\/receive",\s*async/g,
      replacement: 'app.post("/gift/:id/receive", { preHandler: requireAuth }, async'
    },

    // Reward routes
    {
      pattern: /app\.post\("\/spaces\/:id\/rewards",\s*async/g,
      replacement: 'app.post("/spaces/:id/rewards", { preHandler: [requireAuth, requireSpaceMembership] }, async'
    },
    {
      pattern: /app\.patch\("\/rewards\/:id",\s*async/g,
      replacement: 'app.patch("/rewards/:id", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.delete\("\/rewards\/:id",\s*async/g,
      replacement: 'app.delete("/rewards/:id", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/rewards\/:id\/redeem",\s*async/g,
      replacement: 'app.post("/rewards/:id/redeem", { preHandler: requireAuth }, async'
    },

    // Ledger/Activity routes
    {
      pattern: /app\.get\("\/spaces\/:id\/ledger",\s*async/g,
      replacement: 'app.get("/spaces/:id/ledger", { preHandler: [requireAuth, requireSpaceMembership] }, async'
    },
    {
      pattern: /app\.get\("\/spaces\/:id\/activity",\s*async/g,
      replacement: 'app.get("/spaces/:id/activity", { preHandler: [requireAuth, requireSpaceMembership] }, async'
    },

    // Utility routes
    {
      pattern: /app\.post\("\/metadata\/peekalink",\s*async/g,
      replacement: 'app.post("/metadata/peekalink", { preHandler: requireAuth }, async'
    },
    {
      pattern: /app\.post\("\/gifts\/parse",\s*async/g,
      replacement: 'app.post("/gifts/parse", { preHandler: requireAuth }, async'
    },
  ];

  let updatedCount = 0;
  routeUpdates.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      updatedCount += matches.length;
    }
  });

  console.log(`✅ Updated ${updatedCount} route definitions with auth middleware`);

  // 3. Write back to file
  fs.writeFileSync(SERVER_PATH, content, 'utf-8');
  console.log('✅ server.js updated successfully!');
  console.log('\n📋 Summary:');
  console.log('  - Added spaceHelpers import');
  console.log(`  - Updated ${updatedCount} routes with authentication middleware`);
  console.log('\n⚠️  Next steps:');
  console.log('  - Update route handlers to use req.user.userId instead of headers');
  console.log('  - Remove old resolveUserKey() calls');
  console.log('  - Set creatorId, ownerId, giverId, etc. from req.user.userId');
}

try {
  updateServerJS();
} catch (error) {
  console.error('❌ Error updating server.js:', error);
  process.exit(1);
}
