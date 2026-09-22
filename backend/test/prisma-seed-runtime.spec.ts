import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const backendRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(backendRoot, "package.json"), "utf8"),
);
const prismaConfig = fs.readFileSync(
  path.join(backendRoot, "prisma.config.ts"),
  "utf8",
);
const dockerfile = fs.readFileSync(
  path.join(backendRoot, "..", "Dockerfile"),
  "utf8",
);

const seedCommand =
  "node ./scripts/with-typescript-compat.cjs ts-node prisma/seed/config.seed.ts";

test("Prisma uses the TypeScript compatibility seed command", () => {
  assert.equal(packageJson.prisma.seed, seedCommand);
  assert.match(
    prismaConfig,
    /seed:\s*'node \.\/scripts\/with-typescript-compat\.cjs ts-node prisma\/seed\/config\.seed\.ts'/,
  );
});

test("Production packaging includes runtime seed compatibility artifacts", () => {
  assert.equal(packageJson.dependencies["typescript-compat"], "npm:typescript@6.0.3");
  assert.equal("typescript-compat" in packageJson.devDependencies, false);
  assert.match(
    dockerfile,
    /COPY --from=backend-builder \/opt\/app\/scripts \.\/scripts/,
  );
  assert.match(
    dockerfile,
    /COPY --from=backend-builder \/opt\/app\/typescript-compat\.cjs \.\//,
  );
});
