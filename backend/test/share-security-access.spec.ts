import test from "node:test";
import assert from "node:assert/strict";
import { canAccessReverseShare } from "../src/share/guard/shareSecurity.guard";

const buildShare = (overrides: any = {}) => ({
  creatorId: "share-creator",
  reverseShare: {
    creatorId: "rs-creator",
    publicAccess: false,
    viewers: [{ email: "viewer@example.com" }],
    ...overrides,
  },
});

test("public reverse shares are accessible to anyone", () => {
  const share = buildShare({ publicAccess: true });
  assert.equal(canAccessReverseShare(share, undefined), true);
  assert.equal(
    canAccessReverseShare(share, { id: "random", email: "x@y.com" }),
    true,
  );
});

test("share creator can access a private reverse share", () => {
  const share = buildShare();
  assert.equal(
    canAccessReverseShare(share, { id: "share-creator" }),
    true,
  );
});

test("reverse share creator can access a private reverse share", () => {
  const share = buildShare();
  assert.equal(
    canAccessReverseShare(share, { id: "rs-creator" }),
    true,
  );
});

test("listed viewer can access a private reverse share (case-insensitive)", () => {
  const share = buildShare();
  assert.equal(
    canAccessReverseShare(share, {
      id: "viewer-id",
      email: "  Viewer@Example.com ",
    }),
    true,
  );
});

test("non-viewer is denied access to a private reverse share", () => {
  const share = buildShare();
  assert.equal(
    canAccessReverseShare(share, {
      id: "stranger",
      email: "stranger@example.com",
    }),
    false,
  );
});

test("removed viewer is denied access (live list)", () => {
  const share = buildShare({ viewers: [] });
  assert.equal(
    canAccessReverseShare(share, {
      id: "viewer-id",
      email: "viewer@example.com",
    }),
    false,
  );
});

test("unauthenticated user is denied access to a private reverse share", () => {
  const share = buildShare();
  assert.equal(canAccessReverseShare(share, undefined), false);
});
