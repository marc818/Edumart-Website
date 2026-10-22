import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useCatalogStore } from './catalog'

export const useCartStore = defineStore('cart', () => {
  const catalog = useCatalogStore()
  const lines = ref([]) // [{ ...catalogItem, quantity }]
  const isOpen = ref(false)

  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
  const total = computed(() => lines.value.reduce((sum, line) => sum + line.price * line.quantity, 0))

  /** Returns a message to show the user. */
  function add(item) {
    const available = catalog.stockOf(item.id)
    const line = lines.value.find((entry) => entry.id === item.id)
    if ((line?.quantity ?? 0) >= available) {
      return available ? `Only ${available} available.` : 'This item is sold out.'
    }
    if (line) line.quantity += 1
    else lines.value.push({ ...item, quantity: 1 })
    return 'Item added to cart'
  }

  function changeQuantity(id, change) {
    const line = lines.value.find((entry) => entry.id === id)
    if (!line) return
    const next = Math.min(line.quantity + change, catalog.stockOf(id) || line.quantity)
    if (next > 0) line.quantity = next
    else lines.value = lines.value.filter((entry) => entry.id !== id)
  }

  const open = () => (isOpen.value = true)
  const close = () => (isOpen.value = false)

  function clear() {
    lines.value = []
    isOpen.value = false
  }

  return { lines, isOpen, count, total, add, changeQuantity, open, close, clear }
})
