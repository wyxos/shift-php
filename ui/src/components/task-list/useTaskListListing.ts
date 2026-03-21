import axios from '@/axios-config';
import { getTaskEnvironment } from '@shared/tasks/metadata';
import { useTaskFilterState } from '@shared/tasks/useTaskFilterState';
import { onBeforeUnmount, ref } from 'vue';
import type { Task } from './types';

export function useTaskListListing() {
    const tasks = ref<Task[]>([]);
    const totalTasks = ref(0);
    const loading = ref(true);
    const error = ref<string | null>(null);
    const deleteLoading = ref<number | null>(null);
    const currentPage = ref(1);
    const lastPage = ref(1);
    const from = ref(0);
    const to = ref(0);
    const highlightedTaskId = ref<number | null>(null);

    const filters = useTaskFilterState({
        includeClosed: true,
        completedStatuses: ['completed', 'closed'],
    });

    let highlightTimer: number | null = null;

    onBeforeUnmount(() => {
        if (highlightTimer) {
            window.clearTimeout(highlightTimer);
        }
    });

    function setFiltersOpen(value: boolean) {
        filters.filtersOpen.value = value;
    }

    function setDraftStatuses(value: string[]) {
        filters.draftStatuses.value = value;
    }

    function setDraftPriorities(value: string[]) {
        filters.draftPriorities.value = value;
    }

    function setDraftSearchTerm(value: string) {
        filters.draftSearchTerm.value = value;
    }

    function setDraftEnvironmentTerm(value: string) {
        filters.draftEnvironmentTerm.value = value;
    }

    function setDraftSortBy(value: string) {
        filters.draftSortBy.value = value;
    }

    function highlightTask(taskId: number) {
        highlightedTaskId.value = taskId;
        if (highlightTimer) {
            window.clearTimeout(highlightTimer);
        }
        highlightTimer = window.setTimeout(() => {
            highlightedTaskId.value = null;
            highlightTimer = null;
        }, 4500);
    }

    async function fetchTasks() {
        loading.value = true;
        error.value = null;

        try {
            const params: Record<string, any> = {
                page: currentPage.value,
                sort_by: filters.appliedSortBy.value,
            };

            const search = filters.appliedSearchTerm.value.trim();
            if (search) {
                params.search = search;
            }

            const environment = filters.appliedEnvironmentTerm.value.trim();
            if (environment) {
                params.environment = environment;
            }

            if (filters.appliedStatuses.value.length && filters.appliedStatuses.value.length < filters.statusOptions.length) {
                params.status = filters.appliedStatuses.value;
            }

            if (filters.appliedPriorities.value.length && filters.appliedPriorities.value.length < filters.priorityOptions.length) {
                params.priority = filters.appliedPriorities.value;
            }

            const response = await axios.get('/shift/api/tasks', {
                params,
            });

            if (Array.isArray(response.data?.data)) {
                tasks.value = response.data.data;
                totalTasks.value = response.data.total ?? response.data.data.length;
                currentPage.value = response.data.current_page ?? currentPage.value;
                lastPage.value = response.data.last_page ?? lastPage.value;
                from.value = response.data.from ?? 0;
                to.value = response.data.to ?? tasks.value.length;
                return;
            }

            if (Array.isArray(response.data)) {
                tasks.value = response.data;
                totalTasks.value = response.data.length;
                currentPage.value = 1;
                lastPage.value = 1;
                from.value = tasks.value.length ? 1 : 0;
                to.value = tasks.value.length;
                return;
            }

            tasks.value = [];
            totalTasks.value = 0;
            currentPage.value = 1;
            lastPage.value = 1;
            from.value = 0;
            to.value = 0;
        } catch (e: any) {
            error.value = e.response?.data?.error || e.message || 'Unknown error';
        } finally {
            loading.value = false;
        }
    }

    function resetFilters() {
        filters.resetFilters();
        currentPage.value = 1;
        void fetchTasks();
    }

    function applyFilters() {
        filters.applyDraftToApplied();
        currentPage.value = 1;
        void fetchTasks();
        filters.filtersOpen.value = false;
    }

    function goToPage(page: number) {
        const next = Math.max(1, Math.min(lastPage.value, page));
        if (next === currentPage.value) return;
        currentPage.value = next;
        void fetchTasks();
    }

    async function deleteTask(taskId: number) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        deleteLoading.value = taskId;
        error.value = null;

        try {
            await axios.delete(`/shift/api/tasks/${taskId}`);
            tasks.value = tasks.value.filter((task) => task.id !== taskId);
            totalTasks.value = Math.max(totalTasks.value - 1, 0);
        } catch (e: any) {
            error.value = e.response?.data?.error || e.message || 'Failed to delete task';
        } finally {
            deleteLoading.value = null;
        }
    }

    function getTaskEnvironmentLabel(task: Task): string {
        return getTaskEnvironment(task) ?? 'Unknown';
    }

    return {
        activeFilterCount: filters.activeFilterCount,
        applyFilters,
        currentPage,
        deleteLoading,
        deleteTask,
        draftEnvironmentTerm: filters.draftEnvironmentTerm,
        draftPriorities: filters.draftPriorities,
        draftSearchTerm: filters.draftSearchTerm,
        draftSortBy: filters.draftSortBy,
        draftStatuses: filters.draftStatuses,
        error,
        fetchTasks,
        filtersOpen: filters.filtersOpen,
        from,
        getTaskEnvironmentLabel,
        goToPage,
        highlightedTaskId,
        highlightTask,
        lastPage,
        loading,
        priorityOptions: filters.priorityOptions,
        resetFilters,
        selectAllPriorities: filters.selectAllPriorities,
        selectAllStatuses: filters.selectAllStatuses,
        setDraftEnvironmentTerm,
        setDraftPriorities,
        setDraftSearchTerm,
        setDraftSortBy,
        setDraftStatuses,
        setFiltersOpen,
        sortByOptions: filters.sortByOptions,
        statusOptions: filters.statusOptions,
        tasks,
        to,
        totalTasks,
    };
}
