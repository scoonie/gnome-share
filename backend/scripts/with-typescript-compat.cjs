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

  const normalizedArg = arg.replace(/\\/g, "/");
  let regexSource = "";

  for (let index = 0; index < normalizedArg.length; index++) {
    const character = normalizedArg[index];

    if (character === "*") {
      if (normalizedArg[index + 1] === "*") {
        if (normalizedArg[index + 2] === "/") {
          regexSource += "(?:.*/)?";
          index += 2;
        } else {
          regexSource += ".*";
          index++;
        }
      } else {
        regexSource += "[^/]*";
      }
      continue;
    }

    regexSource += /[.+?^${}()|[\]\\]/.test(character)
      ? `\\${character}`
      : character;
  }

  const pattern = new RegExp(`^${regexSource}$`);
  const matches = [];
  const directories = [cwd];

  while (directories.length > 0) {
    const directory = directories.pop();
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(cwd, absolutePath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        directories.push(absolutePath);
      } else if (pattern.test(relativePath)) {
        matches.push(relativePath);
      }
    }
  }

  return matches.length > 0 ? matches : [arg];
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
