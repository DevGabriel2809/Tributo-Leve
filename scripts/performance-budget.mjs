import { readdir, readFile, stat } from "node:fs/promises"
import { gzipSync } from "node:zlib"
import path from "node:path"

const dist = path.join(process.cwd(), "dist")
const rows = []
async function walk(dir) {
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry)
    const info = await stat(full)
    if (info.isDirectory()) await walk(full)
    else if (/\.(js|css)$/i.test(entry)) {
      const content = await readFile(full)
      rows.push({ file: path.relative(dist, full), bytes: content.length, gzip: gzipSync(content).length })
    }
  }
}
await walk(dist)
rows.sort((a,b) => b.gzip-a.gzip)
const totalGzip = rows.reduce((sum,item) => sum + item.gzip, 0)
console.table(rows.map((item) => ({ arquivo: item.file, kb: (item.bytes/1024).toFixed(1), gzipKB: (item.gzip/1024).toFixed(1) })))
console.log(`JS/CSS total comprimido: ${(totalGzip/1024).toFixed(1)} KB`)
const oversized = rows.filter((item) => item.file.endsWith(".js") && item.gzip > 500*1024)
if (oversized.length) {
  console.warn("Atenção: existe bundle JavaScript acima de 500 KB gzip. Considere divisão adicional de código.")
  process.exitCode = 2
} else {
  console.log("Performance budget: OK.")
}
