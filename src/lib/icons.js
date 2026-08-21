const assets = import.meta.glob('../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const urls = Object.freeze(Object.fromEntries(
  Object.entries(assets).map(([path, url]) => {
    const filename = path.split('/').pop().replace(/\.svg$/, '')
    return [filename.replaceAll('-', '_'), url]
  }),
))

export function iconUrl(name, filled = false) {
  const normalized = String(name || '').trim().replaceAll('-', '_')
  if (!normalized) return ''
  return urls[`${normalized}${filled ? '_fill' : ''}`] || urls[normalized] || ''
}
