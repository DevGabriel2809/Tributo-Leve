import { readFile, writeFile } from "node:fs/promises"
import { transform } from "esbuild"

const target = new URL("../dist/tax-engine.js", import.meta.url)
const source = await readFile(target, "utf8")
const result = await transform(source, { minify: true, legalComments: "none", target: "es2022" })
await writeFile(target, result.code, "utf8")
