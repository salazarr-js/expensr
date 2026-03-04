<script setup lang="ts">
import { ref } from "vue";
import { useAccountsData } from "./composables/useAccountsData";
import AppHeader from "./components/AppHeader.vue";
import DashboardView from "./views/DashboardView.vue";
import TransactionsView from "./views/TransactionsView.vue";
import PeopleView from "./views/PeopleView.vue";
import SpendingView from "./views/SpendingView.vue";

const activeTab = ref<string>("dashboard");
const { loading, error } = useAccountsData();
</script>

<template>
  <div class="relative z-10 min-h-screen">
    <AppHeader :activeTab="activeTab" @update:activeTab="activeTab = $event" />
    <main class="max-w-6xl mx-auto px-6 py-6">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <p class="text-text-muted text-sm">Loading data...</p>
      </div>
      <div v-else-if="error" class="flex items-center justify-center py-20">
        <p class="text-danger text-sm">{{ error }}</p>
      </div>
      <template v-else>
        <DashboardView v-if="activeTab === 'dashboard'" />
        <TransactionsView v-else-if="activeTab === 'transactions'" />
        <PeopleView v-else-if="activeTab === 'people'" />
        <SpendingView v-else-if="activeTab === 'spending'" />
      </template>
    </main>
  </div>
</template>
