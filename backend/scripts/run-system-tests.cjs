const { spawn } = require("child_process");
const path = require("path");
const waitOn = require("wait-on");

const cwd = path.resolve(__dirname, "..");
const prismaBin = require.resolve("prisma/build/index.js");
const nestBin = require.resolve("@nestjs/cli/bin/nest.js");
const newmanBin = require.resolve("newman/bin/newman.js");
const compatRequire = `--require=${path.join(cwd, "typescript-compat.cjs")}`;
const compatEnv = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, compatRequire]
    .filter(Boolean)
    .join(" "),
};

function runNodeScript(scriptPath, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${path.basename(scriptPath)} exited with ${
            signal ? `signal ${signal}` : `code ${code}`
          }`,
        ),
      );
    });
  });
}

async function main() {
  await runNodeScript(prismaBin, ["migrate", "reset", "-f"], compatEnv);
  await runNodeScript(prismaBin, ["db", "seed"], compatEnv);

  const serverEnv = {
    ...compatEnv,
    NODE_ENV: process.env.NODE_ENV || "development",
  };

  const server = spawn(process.execPath, [nestBin, "start"], {
    cwd,
    env: serverEnv,
    stdio: "inherit",
  });
  let serverReady = false;

  const stopServer = () => {
    if (!server.killed) {
      server.kill();
    }
  };

  const handleSigInt = () => {
    stopServer();
    process.exit(130);
  };
  const handleSigTerm = () => {
    stopServer();
    process.exit(143);
  };
  process.on("exit", stopServer);
  process.on("SIGINT", handleSigInt);
  process.on("SIGTERM", handleSigTerm);
  const serverFailure = new Promise((_, reject) => {
    server.once("error", reject);
    server.once("exit", (code, signal) => {
      if (!serverReady) {
        reject(
          new Error(
            `Nest server exited before readiness with ${
              signal ? `signal ${signal}` : `code ${code}`
            }`,
          ),
        );
      }
    });
  });

  try {
    await Promise.race([
      waitOn({
        resources: ["http://localhost:8080/api/configs"],
        timeout: 60_000,
      }).then(() => {
        serverReady = true;
      }),
      serverFailure,
    ]);
    await runNodeScript(newmanBin, ["run", "./test/newman-system-tests.json"]);
  } finally {
    process.removeListener("exit", stopServer);
    process.removeListener("SIGINT", handleSigInt);
    process.removeListener("SIGTERM", handleSigTerm);
    stopServer();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
