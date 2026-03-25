<script setup lang="ts">
import { ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import type { Person, CreateRecord } from "@slzr/expensr-shared";
import { usePeopleStore } from "@/stores/people";
import { getColor } from "@/utils/colors";
import { formatMoneyParts } from "@/utils/money";
import { PersonFormModal } from "@/components/PersonFormModal";
import { RecordFormModal } from "@/components/RecordFormModal";
import { useAlertDialog } from "@/composables/useAlertDialog";

const peopleStore = usePeopleStore();
const { people, loading, error } = storeToRefs(peopleStore);
const alert = useAlertDialog();

const showFormModal = ref(false);
const selectedPerson = ref<Person | undefined>();

/** Settlement modal state. */
const showSettlementModal = ref(false);
const settlementData = ref<Partial<CreateRecord> | undefined>();

/** Open settlement form pre-filled for a person. */
function openSettlement(person: Person) {
  settlementData.value = {
    type: "settlement",
    personIds: [person.id],
  };
  showSettlementModal.value = true;
}

function openCreate() {
  selectedPerson.value = undefined;
  showFormModal.value = true;
}

function openEdit(person: Person) {
  selectedPerson.value = person;
  showFormModal.value = true;
}

async function deletePerson(person: Person) {
  const confirmed = await alert.destructive({
    title: `Remove ${person.name}?`,
    message: "Their shared expense links will be removed, but the records will stay.",
    onConfirm: () => peopleStore.deletePerson(person.id),
  });
  if (confirmed) {
    showFormModal.value = false;
    useToast().add({ title: "Person removed", color: "success" });
  }
}

/** Initial of the person's name for avatar fallback. */
function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

onMounted(peopleStore.fetchPeople);
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="People">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New person" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="loading && !people.length" class="flex items-center justify-center mt-[25vh]">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-dimmed animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="error && !people.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-wifi-off" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">Failed to load people</h2>
        <p class="mt-1 text-sm text-muted">Something went wrong. Check your connection and try again.</p>
        <UButton icon="i-lucide-refresh-cw" label="Retry" class="mt-6" :loading="loading" @click="peopleStore.fetchPeople" />
      </div>

      <!-- Empty -->
      <div v-else-if="!people.length" class="flex flex-col items-center text-center mt-[25vh]">
        <UIcon name="i-lucide-users" class="mb-4 size-16 text-dimmed/40" />
        <h2 class="text-lg font-semibold text-highlighted">No people yet</h2>
        <p class="mt-1 text-sm text-muted">Add people to track shared expenses.</p>
        <UButton icon="i-lucide-plus" label="New person" class="mt-6" @click="openCreate" />
      </div>

      <!-- People grid -->
      <div v-else class="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <UCard
          v-for="person in people"
          :key="person.id"
          tabindex="0"
          role="button"
          class="cursor-pointer hover:ring-1 hover:ring-default-border focus:ring-1 focus:ring-primary focus:outline-none transition-shadow"
          @click="openEdit(person)"
          @keydown.enter="openEdit(person)"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex items-center justify-center size-10 rounded-full shrink-0 font-semibold"
              :style="{ backgroundColor: getColor(person.color)[100], color: getColor(person.color)[500] }"
            >
              {{ getInitial(person.name) }}
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-highlighted truncate">{{ person.name }}</h3>
              <RouterLink
                v-if="person.recordCount > 0"
                :to="{ name: 'records', query: { person: String(person.id) } }"
                class="text-xs text-muted hover:text-highlighted transition-colors"
                @click.stop
              >
                {{ person.recordCount }} shared {{ person.recordCount === 1 ? 'record' : 'records' }} →
              </RouterLink>
              <p v-else class="text-xs text-muted">No shared records</p>
            </div>
          </div>

          <div class="mt-3 flex items-end justify-between">
            <UButton
              v-if="person.balance > 0"
              icon="i-lucide-banknote"
              label="Payment"
              size="xs"
              variant="soft"
              color="neutral"
              @click.stop="openSettlement(person)"
            />
            <div v-else />
            <div class="text-right">
              <p
                class="text-lg font-heading font-bold tracking-tight"
                :class="person.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : person.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted'"
              >
                <template v-if="person.balance > 0">+</template>
                {{ formatMoneyParts(person.balance).integer }}<span class="text-sm font-medium text-muted">{{ formatMoneyParts(person.balance).decimal }}</span>
              </p>
              <p class="text-[11px] text-muted">
                {{ person.balance > 0 ? 'owes you' : person.balance < 0 ? 'you owe' : 'settled' }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <PersonFormModal v-model:open="showFormModal" :person="selectedPerson" @delete="deletePerson" />

  <!-- Settlement modal: pre-filled with type=settlement and person -->
  <RecordFormModal
    v-model:open="showSettlementModal"
    :initial-data="settlementData"
    @update:open="!$event && peopleStore.fetchPeople()"
  />
</template>
