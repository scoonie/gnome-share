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
        if (entry.name === "node_modules") {
          continue;
        }
        directories.push(absolutePath);
      } else if (pattern.test(relativePath)) {
        matches.push(relativePath);
      }
    }
  }

  return matches.length > 0 ? matches : [arg];
}

function expandNodeArgs(nodeArgs) {
  const nodeValueOptions = new Set([
    "-e",
    "--eval",
    "-p",
    "--print",
    "-r",
    "--require",
    "--import",
    "--loader",
    "--test-name-pattern",
    "--test-reporter",
    "--test-reporter-destination",
    "--watch-path",
  ]);
  const positionals = [];
  const prefix = [];
  let consumeNext = false;
  let parsingOptions = true;

  for (const nodeArg of nodeArgs) {
    if (!parsingOptions) {
      positionals.push(nodeArg);
      continue;
    }

    prefix.push(nodeArg);

    if (consumeNext) {
      consumeNext = false;
      continue;
    }

    if (nodeArg === "--") {
      parsingOptions = false;
      continue;
    }

    if (!nodeArg.startsWith("-")) {
      parsingOptions = false;
      positionals.push(prefix.pop());
      continue;
    }

    const optionName = nodeArg.split("=")[0];
    if (nodeValueOptions.has(optionName) && !nodeArg.includes("=")) {
      consumeNext = true;
    }
  }

  return [...prefix, ...positionals.flatMap(expandArg)];
}

let expandedArgs;
try {
  expandedArgs = target === "node" ? expandNodeArgs(args) : args.flatMap(expandArg);
} catch (error) {
  console.error(error);
  process.exit(1);
}
const resolvedTarget = {
  node: () => ({
    command: process.execPath,
    args: expandedArgs,
  }),
  nest: () => ({
    command: process.execPath,
    args: [require.resolve("@nestjs/cli/bin/nest.js"), ...expandedArgs],
  }),
  "ts-node": () => ({
    command: process.execPath,
    args: [require.resolve("ts-node/dist/bin.js"), ...expandedArgs],
  }),
}[target]?.();

if (!resolvedTarget) {
  console.error(`Unsupported target: ${target}`);
  process.exit(1);
}

const child = spawn(resolvedTarget.command, resolvedTarget.args, {
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
