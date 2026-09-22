const { spawn } = require("child_process");

const nextBin = require.resolve("next/dist/bin/next");

function runBuild(args) {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(process.execPath, [nextBin, "build", ...args], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code, output, signal });
    });
  });
}

async function main() {
  const primary = await runBuild([]);
  if (primary.code === 0) {
    return;
  }

  const output = primary.output.toLowerCase();
  const needsWebpackFallback =
    output.includes("postcss-preset-mantine") &&
    (output.includes("postcss") || output.includes("turbopack"));

  if (!needsWebpackFallback) {
    process.exit(primary.code ?? 1);
  }

  console.warn(
    "Retrying Next.js production build with webpack due to the current Turbopack/PostCSS Mantine compatibility issue.",
  );

  const fallback = await runBuild(["--webpack"]);
  if (fallback.code !== 0) {
    process.exit(fallback.code ?? 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
