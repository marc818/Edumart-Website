import { request } from './api'

/** Returns catalog rows mapped to the shape used by the UI (price in pesos, not centavos). */
export async function fetchCatalog() {
  const data = await request('/api/catalog', { fallback: 'catalog' })
  return (data.items || []).map((row) => ({
    id: row.item_id,
    category: row.category,
    name: row.name,
    seller: row.seller,
    price: row.price_centavos / 100,
    icon: row.icon,
    condition: row.condition_label,
    stock: row.stock,
  }))
}
