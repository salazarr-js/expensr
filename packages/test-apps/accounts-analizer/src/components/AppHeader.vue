<script setup lang="ts">
defineProps<{
  activeTab: string;
}>();

const emit = defineEmits<{
  (e: "update:activeTab", tab: string): void;
}>();

const tabs = ["dashboard", "transactions", "people", "spending"] as const;
</script>

<template>
  <header
    class="sticky top-0 z-20 backdrop-blur-md bg-bg-page/90 border-b border-border-light"
  >
    <div class="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
      <h1
        class="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight"
      >
        Expensr
        <span class="text-text-muted font-normal text-sm ml-2"
          >Accounts Analyzer</span
        >
      </h1>
      <nav class="flex gap-1">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="emit('update:activeTab', tab)"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize"
          :class="
            activeTab === tab
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-bg-card'
          "
        >
          {{ tab }}
        </button>
      </nav>
    </div>
  </header>
</template>
