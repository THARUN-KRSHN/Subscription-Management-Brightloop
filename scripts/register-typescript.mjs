// Use the project's existing TypeScript compiler; also works on Node builds without native TS stripping.
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            verbatimModuleSyntax: true,
          },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
