<script setup>
defineProps({ showMine: { type: Boolean, default: false } })
</script>

<template>
  <div class="locker-legend">
    <span><i class="locker-swatch available" />Available</span>
    <span><i class="locker-swatch reserved" />Reserved (awaiting payment)</span>
    <span><i class="locker-swatch occupied" />Occupied (paid item inside)</span>
    <span v-if="showMine"><i class="locker-swatch mine" />Your locker</span>
  </div>
</template>
