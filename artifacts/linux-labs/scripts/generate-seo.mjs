import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(root, "../dist/public")
const robotsPath = path.join(publicDir, "robots.txt")
const sitemapPath = path.join(publicDir, "sitemap.xml")
const configuredUrl = process.env.VITE_SITE_URL?.trim()

if (!configuredUrl) {
  await rm(sitemapPath, { force: true })
  console.warn("SEO: VITE_SITE_URL is not set; skipping sitemap generation.")
  process.exit(0)
}

let siteUrl
try {
  siteUrl = new URL(configuredUrl).toString().replace(/\/$/, "")
} catch {
  throw new Error(`SEO: VITE_SITE_URL must be an absolute URL, received "${configuredUrl}".`)
}

const routes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/terms", changefreq: "monthly", priority: "0.3" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    ({ path, changefreq, priority }) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`

await mkdir(publicDir, { recursive: true })
await writeFile(sitemapPath, sitemap)

const robots = await readFile(robotsPath, "utf8")
const withoutSitemap = robots.replace(/\nSitemap:\s*\S+\s*$/m, "").trimEnd()
await writeFile(robotsPath, `${withoutSitemap}\n\nSitemap: ${siteUrl}/sitemap.xml\n`)

console.log(`SEO: generated sitemap for ${siteUrl}`)