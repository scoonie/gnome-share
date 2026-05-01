import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidTimespan,
  parseRelativeDateToAbsolute,
  stringToTimespan,
} from "../src/utils/date.util";
import { ShareService } from "../src/share/share.service";
import { ReverseShareService } from "../src/reverseShare/reverseShare.service";
import { BadRequestException } from "@nestjs/common";

test("parseRelativeDateToAbsolute rejects permanent shares", () => {
  assert.throws(
    () => parseRelativeDateToAbsolute("never"),
    /Permanent shares are not supported/,
  );
});

test("parseRelativeDateToAbsolute parses relative dates", () => {
  const before = Date.now();
  const result = parseRelativeDateToAbsolute("2-days").getTime();
  const after = Date.now();

  assert.ok(result >= before + 2 * 24 * 60 * 60 * 1000);
  assert.ok(result <= after + 2 * 24 * 60 * 60 * 1000);
});

test("timespan parser validates supported units", () => {
  assert.deepEqual(stringToTimespan("3 months"), {
    value: 3,
    unit: "months",
  });
  assert.equal(isValidTimespan("3 months"), true);
  assert.equal(isValidTimespan("3 decades"), false);
});

test("ShareService rejects permanent share creation before writing files", async () => {
  const service = new ShareService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { getByToken: async () => null } as any,
    {} as any,
  );
  service.isShareIdAvailable = async () => ({ isAvailable: true });

  await assert.rejects(
    service.create({ id: "abc", expiration: "never" } as any),
    BadRequestException,
  );
});

test("ReverseShareService rejects permanent reverse shares", async () => {
  const service = new ReverseShareService({} as any, {} as any, {} as any);

  await assert.rejects(
    service.create({ shareExpiration: "never" } as any, "creator-id"),
    BadRequestException,
  );
});
