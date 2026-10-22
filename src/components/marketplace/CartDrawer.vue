<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useStudentStore } from '@/stores/student'
import { useToast } from '@/composables/useToast'
import { createCheckout } from '@/services/paymentService'
import { peso } from '@/utils/format'

const auth = useAuthStore()
const cart = useCartStore()
const student = useStudentStore()
const { notify } = useToast()
const loading = ref(false)

async function checkout() {
  if (!cart.lines.length) return notify('Your cart is empty.')
  if (!auth.email.trim()) return notify('Please add an email address to your account before checkout.')
  if (auth.isStudent && !student.isVerified) return notify('Student Verification Required')

  loading.value = true
  try {
    const checkoutUrl = await createCheckout({
      cartItems: cart.lines,
      buyerEmail: auth.email.trim(),
      studentId: auth.studentId,
      paymentMethod: 'gcash',
    })
    window.location.href = checkoutUrl
  } catch (error) {
    console.error('Checkout error:', error)
    notify(error.message || 'Unable to start checkout. Please try again.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="cart.isOpen" class="cart-overlay" @click.self="cart.close()">
    <aside class="cart-drawer">
      <div class="cart-header">
        <h2>Shopping Cart</h2>
        <button @click="cart.close()">×</button>
      </div>

      <div class="cart-items">
        <div v-if="cart.lines.length === 0" class="cart-empty">
          🛒
          <h3>Your cart is empty</h3>
          <p>Add academic materials from the marketplace to see them here.</p>
        </div>
        <div v-for="line in cart.lines" :key="line.id" class="cart-item">
          <span>{{ line.icon }}</span>
          <div>
            <h3>{{ line.name }}</h3>
            <p>{{ line.category }} · {{ line.seller }}</p>
            <div class="quantity">
              <button @click="cart.changeQuantity(line.id, -1)">−</button>
              <b>{{ line.quantity }}</b>
              <button @click="cart.changeQuantity(line.id, 1)">+</button>
            </div>
          </div>
          <strong>{{ peso(line.price * line.quantity) }}</strong>
        </div>
      </div>

      <div class="cart-footer">
        <strong>Total <span>{{ peso(cart.total) }}</span></strong>
        <button class="home-btn" :disabled="loading" @click="checkout">
          {{ loading ? 'Preparing Checkout...' : 'Proceed to Checkout' }}
        </button>
      </div>
    </aside>
  </div>
</template>
