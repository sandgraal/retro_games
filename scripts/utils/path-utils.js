import path from "node:path";

export function resolveWithinBase(baseDir, targetPath, options = {}) {
  const { allowBase = false, resolveFrom = baseDir, errorMessage } = options;
  const base = path.resolve(baseDir);
  const resolved = path.resolve(resolveFrom, targetPath);
  const relative = path.relative(base, resolved);
  const isWithinBase =
    relative === ""
      ? allowBase
      : !relative.startsWith("..") && !path.isAbsolute(relative);

  if (!isWithinBase) {
    throw new Error(errorMessage || `Path must stay within ${base}: ${targetPath}`);
  }

  return resolved;
}
