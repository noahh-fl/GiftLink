#!/usr/bin/env python3
"""
Script to automatically add authentication to routes in server.js
This updates all routes to use JWT authentication instead of header-based auth
"""

import re
import sys

def update_server_js(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Add helper import
    if 'isSpaceMember' not in content:
        content = content.replace(
            'import { requireAuth, requireSpaceMembership, requireSpaceOwnership } from "./middleware/auth.js";',
            'import { requireAuth, requireSpaceMembership, requireSpaceOwnership } from "./middleware/auth.js";\n' +
            'import { isSpaceMember, isSpaceOwner, addSpaceMember } from "./lib/spaceHelpers.js";'
        )

    # Routes that need requireAuth
    auth_routes = [
        (r'app\.post\("/space",', 'app.post("/space", { preHandler: requireAuth },'),
        (r'app\.post\("/spaces",', 'app.post("/spaces", { preHandler: requireAuth },'),
        (r'app\.get\("/spaces"\,', 'app.get("/spaces", { preHandler: requireAuth },'),
        (r'app\.post\("/spaces/join",', 'app.post("/spaces/join", { preHandler: requireAuth },'),
        (r'app\.post\("/wishlist",', 'app.post("/wishlist", { preHandler: requireAuth },'),
        (r'app\.post\("/metadata/peekalink",', 'app.post("/metadata/peekalink", { preHandler: requireAuth },'),
        (r'app\.post\("/gifts/parse",', 'app.post("/gifts/parse", { preHandler: requireAuth },'),
    ]

    # Routes that need requireAuth + requireSpaceMembership
    membership_routes = [
        (r'app\.get\("/spaces/:id"\,', 'app.get("/spaces/:id", { preHandler: [requireAuth, requireSpaceMembership] },'),
        (r'app\.get\("/wishlist"\,', 'app.get("/wishlist", { preHandler: requireAuth },'),  # Will check membership manually
        (r'app\.post\("/spaces/:id/gifts",', 'app.post("/spaces/:id/gifts", { preHandler: [requireAuth, requireSpaceMembership] },'),
    ]

    # Routes that need requireAuth + requireSpaceOwnership
    owner_routes = [
        (r'app\.patch\("/spaces/:id"\,', 'app.patch("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] },'),
        (r'app\.delete\("/spaces/:id"\,', 'app.delete("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] },'),
        (r'app\.get\("/spaces/:id/code"\,', 'app.get("/spaces/:id/code", { preHandler: [requireAuth, requireSpaceOwnership] },'),
        (r'app\.post\("/spaces/:id/code/rotate"\,', 'app.post("/spaces/:id/code/rotate", { preHandler: [requireAuth, requireSpaceOwnership] },'),
    ]

    # Apply replacements
    for pattern, replacement in auth_routes + membership_routes + owner_routes:
        content = re.sub(pattern, replacement, content)

    # Save
    with open(file_path, 'w') as f:
        f.write(content)

    print(f"✅ Updated {file_path} with authentication middleware")

if __name__ == '__main__':
    update_server_js('/Users/noahflewelling/giftlink/backend/server.js')
