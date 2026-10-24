// Test-only module hooks, so plain Node can load app modules:
//  - `server-only` is resolved by Next's bundler, not from node_modules: make it an empty module.
//  - `@/...` is the app's path alias for src/: map it to the real file.
import * as moduleApi from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

export function resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    // Next runtime modules that need a running server: tiny stand-ins so the query layer loads under plain Node.
    if (specifier === "next/cache") {
      return {
        url:
          "data:text/javascript," +
          encodeURIComponent(
            "export const unstable_cache = (fn) => fn; export const revalidateTag = () => {}; export const revalidatePath = () => {};"
          ),
        shortCircuit: true,
      };
    }
    if (specifier === "next/headers") {
      return {
        url:
          "data:text/javascript," +
          encodeURIComponent("export async function cookies() { return { get: () => undefined }; }"),
        shortCircuit: true,
      };
    }
    if (specifier.startsWith("@/")) {
      const base = new URL(specifier.slice(2), SRC);
      for (const candidate of [`${base.pathname}.ts`, `${base.pathname}/index.ts`]) {
        if (existsSync(candidate)) return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    // The app writes extensionless relative imports ("./index"); Next resolves them, plain Node does not.
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith(SRC.href)) {
      const base = new URL(specifier, context.parentURL);
      for (const candidate of [`${base.pathname}.ts`, `${base.pathname}/index.ts`]) {
        if (!/\.\w+$/.test(base.pathname) && existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
}

if (typeof moduleApi.registerHooks === "function") {
  moduleApi.registerHooks({ resolve });
} else if (typeof moduleApi.register === "function") {
  moduleApi.register(import.meta.url, import.meta.url);
}
