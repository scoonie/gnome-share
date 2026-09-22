const Module = require("module");

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  if (request === "typescript") {
    return originalResolveFilename("typescript-compat", parent, isMain, options);
  }

  return originalResolveFilename(request, parent, isMain, options);
};

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "typescript") {
    return originalLoad("typescript-compat", parent, isMain);
  }

  return originalLoad(request, parent, isMain);
};
