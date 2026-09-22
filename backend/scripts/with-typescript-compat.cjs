const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const [target, ...args] = process.argv.slice(2);

if (!target) {
  console.error("Usage: node ./scripts/with-typescript-compat.cjs <target> [...args]");
  process.exit(1);
}

const cwd = path.resolve(__dirname, "..");
const compatRequire = `--require=${path.join(cwd, "typescript-compat.cjs")}`;
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, compatRequire]
    .filter(Boolean)
    .join(" "),
};

const command = process.execPath;
const resolvedTarget =
  target === "node"
    ? null
    : {
        nest: () => require.resolve("@nestjs/cli/bin/nest.js"),
        "ts-node": () => require.resolve("ts-node/dist/bin.js"),
      }[target]?.();

if (target !== "node" && !resolvedTarget) {
  console.error(`Unsupported target: ${target}`);
  process.exit(1);
}

function expandArg(arg) {
  if (!arg.includes("*")) {
    return [arg];
  }

  if (path.dirname(arg).includes("*")) {
    throw new Error(
      `Unsupported glob pattern "${arg}". Only flat filename globs are supported here.`,
    );
  }

  const directory = path.resolve(cwd, path.dirname(arg));
  const pattern = path
    .basename(arg)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const matcher = new RegExp(`^${pattern}$`);

  return fs
    .readdirSync(directory)
    .sort()
    .filter((entry) => matcher.test(entry))
    .map((entry) => path.join(path.dirname(arg), entry));
}

let expandedArgs;
try {
  expandedArgs = args.flatMap(expandArg);
} catch (error) {
  console.error(error);
  process.exit(1);
}
const commandArgs =
  target === "node" ? expandedArgs : [resolvedTarget, ...expandedArgs];

const child = spawn(command, commandArgs, {
  cwd,
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
