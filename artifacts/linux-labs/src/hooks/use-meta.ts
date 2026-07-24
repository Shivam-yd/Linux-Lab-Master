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

export function useMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title
    setMeta("property", "og:title", title)
    setMeta("name", "twitter:title", title)
    if (description) {
      setMeta("name", "description", description)
      setMeta("property", "og:description", description)
      setMeta("name", "twitter:description", description)
    }
  }, [title, description])
}
