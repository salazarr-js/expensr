<script setup lang="ts">
import { ref, computed } from "vue";

export type AlertDialogColor = "error" | "warning" | "primary";

const props = withDefaults(
  defineProps<{
    title?: string;
    message?: string;
    /** Optional list of items displayed as chips below the message. */
    chips?: string[];
    icon?: string;
    color?: AlertDialogColor;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => Promise<void> | void;
  }>(),
  {
    title: "Are you sure?",
    message: "This action cannot be undone.",
    icon: "i-lucide-alert-triangle",
    color: "primary",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
  },
);

const emit = defineEmits<{ close: [confirmed: boolean] }>();

const busy = ref(false);

/** Maps dialog color to a translucent background for the icon circle. */
const iconBgClass = computed(() => {
  const map: Record<AlertDialogColor, string> = {
    error: "bg-error/10",
    warning: "bg-warning/10",
    primary: "bg-primary/10",
  };
  return map[props.color];
});

const iconColorClass = computed(() => {
  const map: Record<AlertDialogColor, string> = {
    error: "text-error",
    warning: "text-warning",
    primary: "text-primary",
  };
  return map[props.color];
});

/** Runs the onConfirm callback, then closes the dialog. Stays open on error. */
async function confirm() {
  busy.value = true;
  try {
    if (props.onConfirm) await props.onConfirm();
    emit("close", true);
  } catch {
    busy.value = false;
  }
}
</script>

<template>
  <UModal
    :open="true"
    :close="false"
    :ui="{ content: 'sm:max-w-sm', header: 'hidden', footer: 'justify-center' }"
    @update:open="emit('close', false)"
  >
    <template #body>
      <div class="flex flex-col items-center text-center gap-4 py-2">
        <div class="flex items-center justify-center size-12 rounded-full" :class="iconBgClass">
          <UIcon :name="icon" class="size-6" :class="iconColorClass" />
        </div>
        <div>
          <h3 v-if="title" class="text-base font-semibold text-highlighted">{{ title }}</h3>
          <p class="text-sm text-muted mt-1">{{ message }}</p>
          <div v-if="chips?.length" class="mt-3 flex flex-wrap justify-center gap-1.5">
            <UBadge v-for="chip in chips" :key="chip" :label="chip" variant="subtle" :color="color" size="sm" />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton :label="cancelLabel" variant="outline" color="neutral" @click="emit('close', false)" />
      <UButton :label="confirmLabel" :color="color" :loading="busy" @click="confirm" />
    </template>
  </UModal>
</template>
