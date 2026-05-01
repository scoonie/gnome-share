import test from "node:test";
import assert from "node:assert/strict";
import * as crypto from "crypto";
import { BadRequestException } from "@nestjs/common";
import { FileService } from "../src/file/file.service";
import { AuthService } from "../src/auth/auth.service";

test("FileService rejects directory traversal when deleting share files", async () => {
  const service = new FileService({} as any, {} as any);

  await assert.rejects(service.deleteAllFiles(".."), BadRequestException);
});

test("FileService rejects invalid file ids before touching storage", async () => {
  const service = new FileService({} as any, {} as any);

  await assert.rejects(
    service.get("share-id", "../not-a-file-id"),
    BadRequestException,
  );
});

test("AuthService encrypts and decrypts refresh tokens with the configured key", () => {
  const key = crypto.randomBytes(32).toString("base64");
  const service = new AuthService(
    {} as any,
    {} as any,
    {
      get: (name: string) => {
        if (name === "internal.cookieEncryptionKey") return key;
        throw new Error(`Unexpected config key ${name}`);
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const encrypt = (service as any).encryptRefreshToken.bind(service);
  const encrypted = encrypt("refresh-token-value");

  assert.notEqual(encrypted, "refresh-token-value");
  assert.equal(service.decryptRefreshToken(encrypted), "refresh-token-value");
});
