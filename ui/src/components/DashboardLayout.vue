<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const props = defineProps<{ appName: string; username?: string }>()

const route = useRoute()

function isActive(name: string) {
  return route.name === name
}
</script>

<template>
  <div class="min-h-screen flex bg-muted/40">
    <aside class="hidden md:block w-64 border-r bg-background">
      <div class="p-4 text-xl font-bold border-b">{{ props.appName }}</div>
      <nav class="p-4 space-y-2">
        <RouterLink
          :to="{ name: 'task-list' }"
          :class="[
            'block rounded px-3 py-2 text-sm transition-colors',
            isActive('task-list') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          ]"
        >
          Tasks
        </RouterLink>
      </nav>
    </aside>
    <div class="flex-1 flex flex-col">
      <header class="border-b bg-background p-4 flex justify-between items-center">
        <div class="md:hidden font-bold">{{ props.appName }}</div>
        <div v-if="props.username" class="text-sm text-muted-foreground">
          Logged in as: <span class="font-semibold">{{ props.username }}</span>
        </div>
      </header>
      <main class="flex-1 overflow-auto p-4">
        <slot />
      </main>
    </div>
  </div>
</template>
