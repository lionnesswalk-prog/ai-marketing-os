import assert from "node:assert/strict";
import { getPrisma } from "../apps/web/lib/prisma";

const prisma = getPrisma();
const email = (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
assert.ok(email);

const user = await prisma.workspaceUser.findUnique({ where: { email } });
assert.ok(user);
assert.equal(user.isPlatformAdmin, true);
assert.equal(user.role, "admin");

const access = await prisma.workspaceAccess.findUnique({
  where: {
    userId_workspaceId: {
      userId: user.id,
      workspaceId: user.workspaceId,
    },
  },
});
assert.ok(access);
assert.equal(access.role, "admin");

console.log("seed bootstrap tests passed");
await prisma.$disconnect();
