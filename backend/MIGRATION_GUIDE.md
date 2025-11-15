# Authentication Migration Guide

## Quick Reference: How to Secure Each Route Type

### 1. Space Creation (POST /space, POST /spaces)
```javascript
// OLD:
app.post("/space", async (req, res) => {
  const space = await createSpaceWithInvite({ name, description, mode });
});

// NEW:
app.post("/space", { preHandler: requireAuth }, async (req, res) => {
  const userId = req.user.userId;
  const space = await createSpaceWithInvite({ name, description, mode });

  // Set owner and add creator as OWNER member
  await prisma.space.update({
    where: { id: space.id },
    data: { ownerId: userId }
  });

  await addSpaceMember(userId, space.id, 'OWNER');
});
```

### 2. Get User's Spaces (GET /spaces)
```javascript
// OLD:
app.get("/spaces", async () => {
  return await prisma.space.findMany();
});

// NEW:
app.post("/spaces", { preHandler: requireAuth }, async (req, res) => {
  const userId = req.user.userId;

  // Only return spaces user is a member of
  const memberships = await prisma.spaceMember.findMany({
    where: { userId },
    include: { space: true }
  });

  return memberships.map(m => m.space);
});
```

### 3. Space Details/Update/Delete (require ownership)
```javascript
app.get("/spaces/:id", { preHandler: [requireAuth, requireSpaceMembership] }, ...);
app.patch("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] }, ...);
app.delete("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] }, ...);
```

### 4. Wishlist Creation (set creatorId)
```javascript
// OLD:
app.post("/wishlist", async (req) => {
  await prisma.wishlistItem.create({
    data: { spaceId, title, url, ... }
  });
});

// NEW:
app.post("/wishlist", { preHandler: requireAuth }, async (req) => {
  const userId = req.user.userId;
  const { spaceId, title, url } = req.body;

  // Check membership
  if (!(await isSpaceMember(userId, spaceId))) {
    return res.status(403).send({ error: 'Not a member' });
  }

  await prisma.wishlistItem.create({
    data: { spaceId, creatorId: userId, title, url, ... }
  });
});
```

### 5. Gift Reservation (set giverId)
```javascript
app.post("/gift/:id/reserve", { preHandler: requireAuth }, async (req) => {
  const userId = req.user.userId;

  await prisma.gift.update({
    where: { id },
    data: { giverId: userId, status: 'RESERVED' }
  });
});
```

### 6. Reward Creation (set ownerId)
```javascript
app.post("/spaces/:id/rewards", { preHandler: requireAuth }, async (req) => {
  const userId = req.user.userId;

  await prisma.reward.create({
    data: { spaceId, ownerId: userId, title, points }
  });
});
```

### 7. Ledger/Activity (set userId/actorId)
```javascript
// When creating ledger entries:
await prisma.ledgerEntry.create({
  data: { spaceId, userId, type, points, reason }
});

// When creating activities:
await prisma.activity.create({
  data: { spaceId, actorId: userId, type, payload }
});
```

## Pattern Summary:
1. **Add middleware**: `{ preHandler: requireAuth }` or `{ preHandler: [requireAuth, requireSpaceMembership] }`
2. **Get user ID**: `const userId = req.user.userId;`
3. **Check membership**: `if (!(await isSpaceMember(userId, spaceId))) return 403;`
4. **Set user fields**: creatorId, ownerId, giverId, userId, actorId, redeemerId
5. **Remove old header checks**: Delete `req.headers['x-user-id']` and `isOwnerRequest()` calls
