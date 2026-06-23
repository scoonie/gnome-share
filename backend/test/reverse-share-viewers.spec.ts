import test from "node:test";
import assert from "node:assert/strict";
import { ReverseShareService } from "../src/reverseShare/reverseShare.service";

const buildConfig = () =>
  ({
    get: (key: string) => {
      if (key === "share.maxExpiration") return { value: 0, unit: "days" };
      if (key === "share.maxSize") return 10_000_000_000;
      return undefined;
    },
  }) as any;

test("ReverseShareService.create normalizes and dedupes viewer emails", async () => {
  let captured: any;
  const prisma = {
    user: {
      findUnique: async () => ({ id: "creator-id", email: "Owner@Example.com" }),
    },
    reverseShare: {
      create: async (args: any) => {
        captured = args;
        return { token: "token-123" };
      },
    },
  } as any;

  const service = new ReverseShareService(buildConfig(), prisma, {} as any);

  const token = await service.create(
    {
      name: "Test",
      shareExpiration: "2-days",
      maxShareSize: 100,
      maxUseCount: 5,
      sendEmailNotification: false,
      simplified: false,
      publicAccess: true,
      viewerEmails: [
        "  User@Example.com ",
        "user@example.com",
        "owner@example.com", // creator's own email should be excluded
        "",
      ],
    } as any,
    "creator-id",
  );

  assert.equal(token, "token-123");
  assert.deepEqual(captured.data.viewers.create, [
    { email: "user@example.com" },
  ]);
});

test("ReverseShareService.update replaces viewer emails", async () => {
  const calls: any[] = [];
  const prisma = {
    reverseShare: {
      findUnique: async () => ({
        id: "rs-1",
        creator: { email: "owner@example.com" },
      }),
    },
    reverseShareViewer: {
      deleteMany: (args: any) => {
        calls.push(["deleteMany", args]);
        return args;
      },
      createMany: (args: any) => {
        calls.push(["createMany", args]);
        return args;
      },
    },
    $transaction: async (ops: any[]) => ops,
  } as any;

  const service = new ReverseShareService(buildConfig(), prisma, {} as any);

  await service.update("rs-1", {
    viewerEmails: ["A@Example.com", "owner@example.com"],
  });

  const createMany = calls.find((c) => c[0] === "createMany");
  assert.deepEqual(createMany[1].data, [
    { email: "a@example.com", reverseShareId: "rs-1" },
  ]);
});

test("ReverseShareService.getAllByUser returns owned and shared reverse shares", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({ id: "user-1", email: "User@Example.com" }),
    },
    reverseShare: {
      findMany: async (args: any) => {
        // verify the OR clause includes the lowercased email lookup
        assert.deepEqual(args.where.OR, [
          { creatorId: "user-1" },
          { viewers: { some: { email: "user@example.com" } } },
        ]);
        return [
          {
            id: "owned",
            creatorId: "user-1",
            viewers: [{ email: "someone@example.com" }],
            shares: [],
          },
          {
            id: "shared",
            creatorId: "other-user",
            viewers: [{ email: "user@example.com" }],
            shares: [],
          },
        ];
      },
    },
  } as any;

  const service = new ReverseShareService(buildConfig(), prisma, {} as any);

  const result = await service.getAllByUser("user-1");

  assert.equal(result.length, 2);

  const owned = result.find((r: any) => r.id === "owned");
  const shared = result.find((r: any) => r.id === "shared");

  assert.equal(owned.isOwner, true);
  assert.deepEqual(owned.viewerEmails, ["someone@example.com"]);

  assert.equal(shared.isOwner, false);
  // viewer emails should not be exposed to non-owners
  assert.deepEqual(shared.viewerEmails, []);
});
