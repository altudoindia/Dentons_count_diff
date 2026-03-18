export function normalizePath(link: string): string {
  return link.replace(/https?:\/\/[^/]+/, '')
}
