import { useEffect } from "react"

function setMeta(attr: string, val: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${val}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, val)
    document.head.appendChild(el)
  }
  el.content = content
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement("link")
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

type MetaOptions = { indexable?: boolean }

export function useMeta(title: string, description?: string, { indexable = true }: MetaOptions = {}) {
  useEffect(() => {
    const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "")
    const canonical = `${siteUrl}${window.location.pathname || "/"}`
    const assetBase = import.meta.env.BASE_URL.endsWith("/")
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`
    const socialImage = new URL(`${assetBase}opengraph.png`, `${siteUrl}/`).href
    document.title = title
    setMeta("name", "robots", indexable ? "index, follow" : "noindex, nofollow")
    setMeta("name", "googlebot", indexable ? "index, follow" : "noindex, nofollow")
    setMeta("property", "og:title", title)
    setMeta("property", "og:type", "website")
    setMeta("property", "og:url", canonical)
    setMeta("property", "og:site_name", "DevLabMaster")
    setMeta("property", "og:image", socialImage)
    setMeta("name", "twitter:title", title)
    setMeta("name", "twitter:url", canonical)
    setMeta("name", "twitter:image", socialImage)
    setLink("canonical", canonical)
    if (description) {
      setMeta("name", "description", description)
      setMeta("property", "og:description", description)
      setMeta("name", "twitter:description", description)
    } else {
      setMeta("name", "description", "")
      setMeta("property", "og:description", "")
      setMeta("name", "twitter:description", "")
    }
  }, [title, description, indexable])
}
