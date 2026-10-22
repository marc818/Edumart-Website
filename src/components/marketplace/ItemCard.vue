<script setup>
import { computed } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import { peso } from '@/utils/format'

const props = defineProps({
  item: { type: Object, required: true },
  showCondition: { type: Boolean, default: false },
})

const catalog = useCatalogStore()
const cart = useCartStore()
const { notify } = useToast()

const left = computed(() => catalog.stockOf(props.item.id))

function addToCart() {
  notify(cart.add(props.item))
}
</script>

<template>
  <article class="student-item">
    <div class="student-item-image">{{ item.icon }}</div>
    <small>{{ item.category }}</small>
    <h3>{{ item.name }}</h3>
    <p>Sold by {{ item.seller }} · {{ left > 0 ? `${left} left` : 'Sold out' }}</p>
    <div class="student-item-bottom">
      <div v-if="showCondition">
        <strong>{{ peso(item.price) }}</strong>
        <span class="admin-badge pending">{{ item.condition }}</span>
      </div>
      <strong v-else>{{ peso(item.price) }}</strong>
      <button class="admin-action primary" :disabled="left < 1" @click="addToCart">
        {{ left < 1 ? 'SOLD OUT' : 'ADD TO CART' }}
      </button>
    </div>
  </article>
</template>
