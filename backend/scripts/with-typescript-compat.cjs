const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const [target, ...args] = process.argv.slice(2);

if (!target) {
  console.error("Usage: node ./scripts/with-typescript-compat.cjs <target> [...args]");
  process.exit(1);
}

const cwd = path.resolve(__dirname, "..");
const compatModulePath = path.join(cwd, "typescript-compat.cjs");

function expandArg(arg) {
  if (!arg.includes("*")) {
    return [arg];
  }

  const normalizedPattern = arg.replace(/\\/g, "/").replace(/^\.\//, "");
  const patternSegments = normalizedPattern.split("/").filter(Boolean);
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
      const pathSegments = relativePath.split("/").filter(Boolean);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules") {
          continue;
        }
        directories.push(absolutePath);
      } else if (matchPathSegments(patternSegments, pathSegments)) {
        matches.push(relativePath);
      }
    }
  }

  return matches.length > 0 ? matches : [arg];
}

function matchPathSegments(patternSegments, pathSegments, patternIndex = 0, pathIndex = 0) {
  if (patternIndex === patternSegments.length) {
    return pathIndex === pathSegments.length;
  }

  const segment = patternSegments[patternIndex];

  if (segment === "**") {
    for (let i = pathIndex; i <= pathSegments.length; i++) {
      if (matchPathSegments(patternSegments, pathSegments, patternIndex + 1, i)) {
        return true;
      }
    }
    return false;
  }

  if (pathIndex >= pathSegments.length) {
    return false;
  }

  if (!matchSegment(segment, pathSegments[pathIndex])) {
    return false;
  }

  return matchPathSegments(patternSegments, pathSegments, patternIndex + 1, pathIndex + 1);
}

function matchSegment(pattern, text) {
  let patternIndex = 0;
  let textIndex = 0;
  let starPatternIndex = -1;
  let starTextIndex = -1;

  while (textIndex < text.length) {
    if (patternIndex < pattern.length && pattern[patternIndex] === text[textIndex]) {
      patternIndex++;
      textIndex++;
      continue;
    }

    if (patternIndex < pattern.length && pattern[patternIndex] === "*") {
      starPatternIndex = patternIndex++;
      starTextIndex = textIndex;
      continue;
    }

    if (starPatternIndex !== -1) {
      patternIndex = starPatternIndex + 1;
      starTextIndex++;
      textIndex = starTextIndex;
      continue;
    }

    return false;
  }

  while (patternIndex < pattern.length && pattern[patternIndex] === "*") {
    patternIndex++;
  }

  return patternIndex === pattern.length;
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
    args: ["--require", compatModulePath, ...expandedArgs],
  }),
  nest: () => ({
    command: process.execPath,
    args: [
      "--require",
      compatModulePath,
      require.resolve("@nestjs/cli/bin/nest.js"),
      ...expandedArgs,
    ],
  }),
  "ts-node": () => ({
    command: process.execPath,
    args: [
      "--require",
      compatModulePath,
      require.resolve("ts-node/dist/bin.js"),
      ...expandedArgs,
    ],
  }),
}[target]?.();

if (!resolvedTarget) {
  console.error(`Unsupported target: ${target}`);
  process.exit(1);
}

const child = spawn(resolvedTarget.command, resolvedTarget.args, {
  cwd,
  env: process.env,
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
