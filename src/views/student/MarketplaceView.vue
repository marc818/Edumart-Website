<script setup>
import { computed, ref } from 'vue'
import PanelSection from '@/components/common/PanelSection.vue'
import ItemCard from '@/components/marketplace/ItemCard.vue'
import MyLockerBanner from '@/components/lockers/MyLockerBanner.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useLockerStore } from '@/stores/lockers'

const catalog = useCatalogStore()
const lockers = useLockerStore()

const query = ref('')
const category = ref('All')
const sort = ref('recommended')

const visibleItems = computed(() => {
  const search = query.value.toLowerCase()
  const filtered = catalog.items.filter(
    (item) =>
      (category.value === 'All' || item.category === category.value) &&
      `${item.name} ${item.category} ${item.seller}`.toLowerCase().includes(search),
  )

  return [...filtered].sort((a, b) => {
    if (sort.value === 'low') return a.price - b.price
    if (sort.value === 'high') return b.price - a.price
    if (sort.value === 'name') return a.name.localeCompare(b.name)
    return a.id - b.id
  })
})

const headerNote = computed(() => {
  const summary = lockers.summary
  const lockerText = summary ? ` · ${summary.available} of ${summary.total} lockers free` : ''
  return `${visibleItems.value.length} items available${lockerText}`
})
</script>

<template>
  <MyLockerBanner show-view-button />

  <PanelSection title="Available Materials">
    <template #head><span>{{ headerNote }}</span></template>

    <div class="student-toolbar">
      <input v-model="query" placeholder="Search textbooks, tools, calculators, reviewers..." aria-label="Search marketplace" />
      <select v-model="sort">
        <option value="recommended">Sort: Recommended</option>
        <option value="low">Price: Low to High</option>
        <option value="high">Price: High to Low</option>
        <option value="name">Name: A-Z</option>
      </select>
    </div>

    <div class="student-chips">
      <button v-for="name in catalog.categories" :key="name" :class="{ active: category === name }" @click="category = name">
        {{ name }}
      </button>
    </div>

    <div class="student-grid">
      <ItemCard v-for="item in visibleItems" :key="item.id" :item="item" show-condition />
      <p v-if="!visibleItems.length" class="admin-muted">No items found.</p>
    </div>
  </PanelSection>
</template>
