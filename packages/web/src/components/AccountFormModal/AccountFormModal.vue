<script setup lang="ts">
import { reactive, ref, computed, watch, toRef } from "vue";
import { storeToRefs } from "pinia";
import type { Account, CreateAccount } from "@slzr/expensr-shared";
import { createAccountSchema, ACCOUNT_TYPES } from "@slzr/expensr-shared";
import { useAccountsStore } from "@/stores/accounts";
import { ApiError } from "@/composables/useApi";
import { IconPicker } from "@/components/IconPicker";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_COLOR } from "@/utils/colors";

const props = defineProps<{
  account?: Account;
}>();

const open = defineModel<boolean>("open", { required: true });

const accountsStore = useAccountsStore();
const { currencies } = storeToRefs(accountsStore);

const currencySearch = ref("");

/** Merges existing currencies with the search term so users can type new ones. */
const currencyItems = computed(() => {
  const search = currencySearch.value.toUpperCase().trim();
  const existing = currencies.value;

  if (!search) return existing;

  const filtered = existing.filter((c) =>
    c.toUpperCase().includes(search),
  );

  if (filtered.length === 0 || !existing.includes(search)) {
    return [...filtered, search];
  }

  return filtered;
});

const typeOptions = ACCOUNT_TYPES.map((t) => ({
  label: t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  value: t,
}));

/** Fallback icon per account type, applied at submit if the user didn't pick one. */
const DEFAULT_ICONS: Record<string, string> = {
  bank: "i-lucide-landmark",
  credit_card: "i-lucide-credit-card",
  cash: "i-lucide-banknote",
  digital_wallet: "i-lucide-smartphone",
  crypto: "i-lucide-bitcoin",
};


function getDefaultIcon(type: string): string {
  return DEFAULT_ICONS[type] ?? "i-lucide-wallet";
}

const defaultState = (): CreateAccount => ({
  name: "",
  type: "bank",
  currency: "",
  color: null,
  icon: null,
  aliases: null,
  isDefault: false,
  startingBalance: 0,
  realBalance: 0,
  realBalanceDate: null,
});

const state = reactive<CreateAccount>(defaultState());

const userPickedIcon = ref(false);

watch(open, (isOpen) => {
  if (!isOpen) return;
  userPickedIcon.value = false;
  nameError.value = "";
  aliasError.value = "";
  accountsStore.fetchCurrencies();
  if (props.account) {
    userPickedIcon.value = true;
    Object.assign(state, {
      name: props.account.name,
      type: props.account.type,
      currency: props.account.currency,
      color: props.account.color,
      icon: props.account.icon,
      aliases: props.account.aliases,
      isDefault: props.account.isDefault,
      startingBalance: props.account.startingBalance,
      realBalance: props.account.realBalance,
      realBalanceDate: props.account.realBalanceDate,
    });
  } else {
    Object.assign(state, defaultState());
  }
});

watch(() => state.type, (type) => {
  if (!userPickedIcon.value && state.icon) {
    state.icon = getDefaultIcon(type);
  }
});

const emit = defineEmits<{ delete: [account: Account] }>();

const form = ref<{ submit: () => Promise<void>; errors: { message: string }[]; dirty: boolean }>();
const loading = ref(false);
const nameError = ref("");
const aliasError = ref("");

// UInputTags works with string[] — convert to/from comma-separated storage
const aliasTags = computed({
  get: () => state.aliases?.split(",").filter(Boolean) ?? [],
  set: (tags: string[]) => {
    const normalized = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    const unique = [...new Set(normalized)];
    if (unique.length < normalized.length) {
      aliasError.value = "Duplicate alias";
    }
    state.aliases = unique.length ? unique.join(",") : null;
  },
});

const hasErrors = computed(() => !!form.value?.errors?.length);

/** Validates, applies defaults for missing color/icon, then creates or updates. */
async function onSubmit() {
  loading.value = true;
  nameError.value = "";
  aliasError.value = "";
  try {
    if (props.account) {
      await accountsStore.updateAccount(props.account.id, { ...state });
    } else {
      const payload = {
        ...state,
        color: state.color || DEFAULT_COLOR,
        icon: state.icon || getDefaultIcon(state.type),
      };
      await accountsStore.createAccount(payload);
    }
    open.value = false;
    useToast().add({
      title: props.account ? "Account updated" : "Account created",
      color: "success",
    });
  } catch (e: unknown) {
    if (e instanceof ApiError && e.code === "DUPLICATE_NAME") {
      nameError.value = e.message;
      return;
    }
    if (e instanceof ApiError && e.code === "DUPLICATE_ALIAS") {
      aliasError.value = e.message;
      return;
    }
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
  <UModal v-model:open="open" :title="account ? 'Edit account' : 'New account'">
    <template #body>
      <UForm ref="form" :schema="createAccountSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name" :error="nameError || undefined">
          <UInput v-model="state.name" placeholder="Banco Galicia" class="w-full" @input="nameError = ''" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Currency" name="currency">
            <UInputMenu
              v-model="state.currency"
              v-model:search-term="currencySearch"
              :items="currencyItems"
              placeholder="USD"
              class="w-full"
              @update:model-value="state.currency = ($event as string).toUpperCase()"
              @update:search-term="currencySearch = $event.toUpperCase()"
            />
          </UFormField>

          <UFormField label="Type" name="type">
            <USelect v-model="state.type" :items="typeOptions" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Starting balance" name="startingBalance">
          <UInput v-model.number="state.startingBalance" type="number" step="0.01" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Color" name="color">
            <ColorPicker v-model="state.color" />
          </UFormField>

          <UFormField label="Icon" name="icon">
            <IconPicker v-model="state.icon" @update:model-value="userPickedIcon = true" />
          </UFormField>
        </div>

        <UFormField label="Aliases" name="aliases" hint="For quick input" :error="aliasError || undefined">
          <UInputTags v-model="aliasTags" placeholder="Add alias..." class="w-full" @update:model-value="aliasError = ''" />
        </UFormField>

        <UFormField name="isDefault">
          <UCheckbox v-model="state.isDefault" label="Default account" description="Used as fallback when no account is specified in quick input" />
        </UFormField>
        <!-- Reconciliation section -->
        <div class="border-t border-default pt-4 mt-4">
          <h4 class="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Reconciliation</h4>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Real balance" name="realBalance">
              <UInput v-model.number="state.realBalance" type="number" step="0.01" placeholder="0" class="w-full" />
            </UFormField>
            <UFormField label="As of" name="realBalanceDate">
              <UInput :model-value="state.realBalanceDate ?? ''" type="date" class="w-full" @update:model-value="state.realBalanceDate = $event || null" />
            </UFormField>
          </div>
        </div>
      </UForm>
    </template>

    <template #footer>
      <UButton v-if="account" label="Delete" icon="i-lucide-trash-2" variant="outline" color="error" @click="emit('delete', account)" />
      <UButton label="Cancel" variant="ghost" color="neutral" @click="open = false" class="ml-auto" />
      <UButton :label="account ? 'Save changes' : 'Create account'" :loading="loading" :disabled="hasErrors || !form?.dirty" @click="form?.submit()" />
    </template>
  </UModal>
</template>
