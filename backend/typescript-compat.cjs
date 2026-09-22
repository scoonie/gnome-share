// Temporary compatibility shim for TypeScript 7.0.x tooling.
// Nest CLI and ts-node still require the TypeScript 6 programmatic API,
// while the project tracks the requested TypeScript 7 package for tsc usage.
// Remove this once the repo can upgrade to tooling that natively supports
// requiring TypeScript 7 without remapping.
const Module = require("module");

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

function mapTypeScriptRequest(request) {
  if (request === "typescript") {
    return "typescript-compat";
  }

  if (request.startsWith("typescript/")) {
    return `typescript-compat/${request.slice("typescript/".length)}`;
  }

  return request;
}

Module._resolveFilename = function patchedResolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  return originalResolveFilename(
    mapTypeScriptRequest(request),
    parent,
    isMain,
    options,
  );
};

Module._load = function patchedLoad(request, parent, isMain) {
  return originalLoad(mapTypeScriptRequest(request), parent, isMain);
};
