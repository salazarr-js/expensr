import { ref } from "vue";
import { defineStore } from "pinia";
import type { RecordWithRelations, CreateRecord, UpdateRecord } from "@slzr/expensr-shared";
import { useApi } from "@/composables/useApi";

export interface RecordFilters {
  accountIds?: number[];
  personId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  categoryId?: number | "none";
  tagId?: number;
  needsReview?: boolean;
}

export const useRecordsStore = defineStore("records", () => {
  const records = ref<RecordWithRelations[]>([]);
  const loading = ref(false);
  const error = ref(false);
  const api = useApi();
  let lastFilters: RecordFilters | undefined;

  /** Loads records from the API. Omit filters to re-use the last-used filters. */
  async function fetchRecords(filters?: RecordFilters) {
    if (filters !== undefined) lastFilters = filters;
    const f = lastFilters;
    loading.value = true;
    error.value = false;
    try {
      const params = new URLSearchParams();
      if (f?.accountIds?.length) params.set("accountId", f.accountIds.join(","));
      if (f?.personId) params.set("personId", String(f.personId));
      if (f?.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f?.dateTo) params.set("dateTo", f.dateTo);
      if (f?.search) params.set("search", f.search);
      if (f?.categoryId) params.set("categoryId", String(f.categoryId));
      if (f?.tagId) params.set("tagId", String(f.tagId));
      if (f?.needsReview) params.set("needsReview", "true");

      const qs = params.toString();
      records.value = await api.get<RecordWithRelations[]>(qs ? `/records?${qs}` : "/records");
    } catch {
      error.value = true;
      useToast().add({ title: "Failed to load records", color: "error" });
    } finally {
      loading.value = false;
    }
  }

  /** Creates a new record and prepends it to the local list. */
  async function createRecord(data: CreateRecord) {
    const record = await api.post<RecordWithRelations>("/records", data);
    // Re-fetch to get joined relations (POST only returns the raw record)
    await fetchRecords();
    return record;
  }

  /** Patches a record. Re-fetches to get updated joined relations. */
  async function updateRecord(id: number, data: UpdateRecord) {
    const record = await api.put<RecordWithRelations>(`/records/${id}`, data);
    await fetchRecords();
    return record;
  }

  /** Deletes a record and removes it from the local list. */
  async function deleteRecord(id: number) {
    await api.del(`/records/${id}`);
    records.value = records.value.filter((r) => r.id !== id);
  }

  /** Partial update multiple records at once (spreadsheet mode). */
  async function batchUpdateRecords(updates: { id: number; [key: string]: unknown }[]) {
    await api.post("/records/batch/update", updates);
    await fetchRecords();
  }

  /** Deletes multiple records by IDs. */
  async function batchDeleteRecords(ids: number[]) {
    await api.post("/records/batch/delete", { ids });
    records.value = records.value.filter((r) => !ids.includes(r.id));
  }

  /** Reorder a record by placing it after or before another record. */
  async function reorderRecord(id: number, target: { afterId?: number; beforeId?: number }) {
    await api.post("/records/reorder", { id, ...target });
    await fetchRecords();
  }

  /** Creates multiple records at once. Returns count of created records. */
  async function batchCreateRecords(data: CreateRecord[]) {
    const result = await api.post<{ created: number; errors: { index: number; error: string }[] }>("/records/batch", data);
    await fetchRecords();
    return result;
  }

  return { records, loading, error, fetchRecords, createRecord, updateRecord, batchUpdateRecords, deleteRecord, batchDeleteRecords, reorderRecord, batchCreateRecords };
});
