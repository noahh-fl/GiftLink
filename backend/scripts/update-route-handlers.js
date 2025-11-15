#!/usr/bin/env node
/**
 * Script to update route handlers to use req.user.userId from JWT
 * Replaces old resolveUserKey() calls with proper user ID extraction
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PATH = path.join(__dirname, '..', 'server.js');

function updateRouteHandlers() {
  console.log('📝 Reading server.js...');
  let content = fs.readFileSync(SERVER_PATH, 'utf-8');

  let changeCount = 0;

  // 1. Remove resolveUserKey import if it exists
  if (content.includes('resolveUserKey')) {
    console.log('🗑️  Removing resolveUserKey import...');
    content = content.replace(/,?\s*resolveUserKey/g, '');
    changeCount++;
  }

  // 2. Replace resolveUserKey() calls with req.user.userId
  // Pattern: const userKey = resolveUserKey(req);
  content = content.replace(
    /const\s+userKey\s*=\s*resolveUserKey\(req\);/g,
    'const userId = req.user.userId;'
  );
  changeCount++;

  // 3. Replace userKey with userId in database operations
  content = content.replace(/userKey:\s*userKey/g, 'userId: userId');
  content = content.replace(/creatorKey:\s*userKey/g, 'creatorId: userId');
  content = content.replace(/ownerKey:\s*userKey/g, 'ownerId: userId');
  content = content.replace(/giverKey:\s*userKey/g, 'giverId: userId');
  content = content.replace(/actorKey:\s*userKey/g, 'actorId: userId');
  content = content.replace(/redeemerKey:\s*userKey/g, 'redeemerId: userId');

  // 4. Update isOwnerRequest() calls - these should now use requireSpaceOwnership middleware
  content = content.replace(/const\s+isOwner\s*=\s*isOwnerRequest\(req\);/g, '// Owner check now handled by middleware');
  content = content.replace(/if\s*\(!isOwner\)\s*\{[^}]*return\s+res\.status\(403\)[^}]*\}/g, '// Ownership check handled by middleware');

  // 5. Update space creation to set ownerId
  // Look for space creation and ensure ownerId is set
  content = content.replace(
    /(await\s+createSpaceWithInvite\([^)]+\);)/g,
    (match) => {
      if (!match.includes('// Set owner after creation')) {
        return match + '\n    // Set owner and add as member\n    await prisma.space.update({ where: { id: space.id }, data: { ownerId: userId } });\n    await addSpaceMember(userId, space.id, "OWNER");';
      }
      return match;
    }
  );

  // 6. Update GET /spaces to filter by user membership
  content = content.replace(
    /app\.get\("\/spaces",.*?async\s*\(req,\s*res\)\s*=>\s*\{(.*?)}\);/gs,
    (match) => {
      if (match.includes('spaceMember.findMany')) {
        return match; // Already updated
      }
      return match.replace(
        /const\s+spaces\s*=\s*await\s+prisma\.space\.findMany\(\);/,
        `const userId = req.user.userId;
    const memberships = await prisma.spaceMember.findMany({
      where: { userId },
      include: { space: true }
    });
    const spaces = memberships.map(m => m.space);`
      );
    }
  );

  console.log(`✅ Updated route handlers`);
  console.log(`   - Replaced userKey with userId throughout`);
  console.log(`   - Updated database field mappings (creatorKey → creatorId, etc.)`);
  console.log(`   - Removed deprecated owner checks`);

  // Write back
  fs.writeFileSync(SERVER_PATH, content, 'utf-8');
  console.log('✅ server.js handlers updated successfully!');
}

try {
  updateRouteHandlers();
} catch (error) {
  console.error('❌ Error updating route handlers:', error);
  process.exit(1);
}
