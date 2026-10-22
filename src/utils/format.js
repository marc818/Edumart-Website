export const peso = (amount) => `₱${Number(amount).toLocaleString()}`

export const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const itemSummary = (items = []) =>
  items.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join(', ') || '—'
