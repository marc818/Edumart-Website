import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchCatalog } from '@/services/catalogService'

export const useCatalogStore = defineStore('catalog', () => {
  const items = ref([])
  const error = ref('')

  const categories = computed(() => ['All', ...new Set(items.value.map((item) => item.category))])
  const totalStock = computed(() => items.value.reduce((sum, item) => sum + item.stock, 0))

  const stockOf = (id) => items.value.find((item) => item.id === id)?.stock ?? 0

  async function load() {
    try {
      items.value = await fetchCatalog()
      error.value = ''
    } catch {
      error.value = 'Unable to load marketplace items. Make sure the server is running.'
    }
  }

  return { items, error, categories, totalStock, stockOf, load }
})
