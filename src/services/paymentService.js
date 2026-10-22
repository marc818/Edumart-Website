import { request } from './api'

/**
 * Creates a PayMongo checkout session through the backend and returns the hosted checkout URL.
 * The backend still expects each cart line as a positional array:
 * [id, category, name, seller, price, icon, condition, quantity]
 * (prices and stock are re-read from the database on the server).
 */
export async function createCheckout({ cartItems, buyerEmail, studentId, paymentMethod = 'gcash' }) {
  const items = cartItems.map((i) => [i.id, i.category, i.name, i.seller, i.price, i.icon, i.condition, i.quantity])
  const data = await request('/api/payment/create-checkout', {
    method: 'POST',
    json: { items, buyerEmail, studentId, paymentMethod },
    fallback: 'Unable to create checkout.',
  })
  return data.checkoutUrl
}
