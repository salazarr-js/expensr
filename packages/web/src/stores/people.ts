import { ref } from "vue";
import { defineStore } from "pinia";
import type { Person, CreatePerson, UpdatePerson } from "@slzr/expensr-shared";
import { useApi } from "@/composables/useApi";

export const usePeopleStore = defineStore("people", () => {
  const people = ref<Person[]>([]);
  const loading = ref(false);
  const error = ref(false);
  const api = useApi();

  async function fetchPeople() {
    loading.value = true;
    error.value = false;
    try {
      people.value = await api.get<Person[]>("/people");
    } catch {
      error.value = true;
      useToast().add({ title: "Failed to load people", color: "error" });
    } finally {
      loading.value = false;
    }
  }

  async function createPerson(data: CreatePerson) {
    const person = await api.post<Person>("/people", data);
    people.value.push(person);
    return person;
  }

  async function updatePerson(id: number, data: UpdatePerson) {
    const person = await api.put<Person>(`/people/${id}`, data);
    const index = people.value.findIndex((p) => p.id === id);
    if (index !== -1) people.value[index] = person;
    return person;
  }

  async function deletePerson(id: number) {
    await api.del(`/people/${id}`);
    people.value = people.value.filter((p) => p.id !== id);
  }

  return { people, loading, error, fetchPeople, createPerson, updatePerson, deletePerson };
});
