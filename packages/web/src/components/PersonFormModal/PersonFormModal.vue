<script setup lang="ts">
import { reactive, ref, computed, watch, nextTick } from "vue";
import type { Person, CreatePerson } from "@slzr/expensr-shared";
import { createPersonSchema } from "@slzr/expensr-shared";
import { usePeopleStore } from "@/stores/people";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_COLOR } from "@/utils/colors";

const props = defineProps<{
  person?: Person;
}>();

const open = defineModel<boolean>("open", { required: true });

const peopleStore = usePeopleStore();

const defaultState = (): CreatePerson => ({
  name: "",
  color: null,
});

const state = reactive<CreatePerson>(defaultState());

watch(open, async (isOpen) => {
  if (!isOpen) return;
  if (props.person) {
    Object.assign(state, {
      name: props.person.name,
      color: props.person.color,
    });
  } else {
    Object.assign(state, defaultState());
  }
  await nextTick();
  touched.value = false;
});

const emit = defineEmits<{ delete: [person: Person] }>();

const form = ref<{ submit: () => Promise<void>; errors: { message: string }[]; dirty: boolean }>();
const loading = ref(false);
const touched = ref(false); // tracks changes UForm can't detect (e.g. ColorPicker)

watch(() => ({ ...state }), () => { touched.value = true; }, { deep: true });

const hasErrors = computed(() => !!form.value?.errors?.length);
const isDirty = computed(() => form.value?.dirty || touched.value);

async function onSubmit() {
  loading.value = true;
  try {
    if (props.person) {
      await peopleStore.updatePerson(props.person.id, { ...state });
    } else {
      // Apply defaults for missing color
      await peopleStore.createPerson({
        ...state,
        color: state.color || DEFAULT_COLOR,
      });
    }
    open.value = false;
    useToast().add({
      title: props.person ? "Person updated" : "Person added",
      color: "success",
    });
  } catch (e: unknown) {
    useToast().add({
      title: e instanceof Error ? e.message : "Something went wrong",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="person ? 'Edit person' : 'New person'">
    <template #body>
      <UForm ref="form" :schema="createPersonSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" placeholder="Angy" class="w-full" />
        </UFormField>

        <UFormField label="Color" name="color">
          <ColorPicker v-model="state.color" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton v-if="person" label="Delete" icon="i-lucide-trash-2" variant="outline" color="error" @click="emit('delete', person)" />
      <UButton label="Cancel" variant="ghost" color="neutral" @click="open = false" class="ml-auto" />
      <UButton :label="person ? 'Save changes' : 'Add person'" :loading="loading" :disabled="hasErrors || !isDirty" @click="form?.submit()" />
    </template>
  </UModal>
</template>
