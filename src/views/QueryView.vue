<script setup>
import { api } from '@/lib'
import { computed, ref } from 'vue'

const name = ref('bulbasaur')
const args = computed(() => ({ name: name.value }))

const { data, isLoading, refetch } = api.endpoints.getPokemon.useQuery(args)
</script>

<template>
  <div class="about">
    <input v-model="name" />

    <button @click="refetch">Refetch</button>
    <div v-if="isLoading">Loading...</div>
    <pre>{{ data }}</pre>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
