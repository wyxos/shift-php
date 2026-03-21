import axios from '@/axios-config';
import { getTaskEnvironment } from '@shared/tasks/metadata';
import {
    DEFAULT_SORT_BY,
    getDefaultStatuses,
    getPriorityOptions,
    getSortByOptions,
    getStatusOptions,
} from '@shared/tasks/presentation';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Task } from './types';

export function useTaskListListing() {
    const tasks = ref<Task[]>([]);
    const totalTasks = ref(0);
    const loading = ref(true);
    const error = ref<string | null>(null);
    const deleteLoading = ref<number | null>(null);
    const filtersOpen = ref(false);
    const currentPage = ref(1);
    const lastPage = ref(1);
    const from = ref(0);
    const to = ref(0);
    const highlightedTaskId = ref<number | null>(null);

    const statusOptions = getStatusOptions({ includeClosed: true });
    const priorityOptions = getPriorityOptions();
    const sortByOptions = getSortByOptions();
    const defaultSortBy = DEFAULT_SORT_BY;
    const defaultStatuses = getDefaultStatuses(statusOptions, ['completed', 'closed']);

    const appliedStatuses = ref<string[]>([...defaultStatuses]);
    const appliedPriorities = ref<string[]>(priorityOptions.map((option) => option.value));
    const appliedSearchTerm = ref('');
    const appliedEnvironmentTerm = ref('');
    const appliedSortBy = ref(defaultSortBy);

    const draftStatuses = ref<string[]>([...appliedStatuses.value]);
    const draftPriorities = ref<string[]>([...appliedPriorities.value]);
    const draftSearchTerm = ref(appliedSearchTerm.value);
    const draftEnvironmentTerm = ref(appliedEnvironmentTerm.value);
    const draftSortBy = ref(appliedSortBy.value);

    const activeFilterCount = computed(() => {
        let count = 0;
        if (appliedStatuses.value.length && appliedStatuses.value.length < statusOptions.length) count += 1;
        if (appliedPriorities.value.length && appliedPriorities.value.length < priorityOptions.length) count += 1;
        if (appliedSearchTerm.value.trim()) count += 1;
        if (appliedEnvironmentTerm.value.trim()) count += 1;
        if (appliedSortBy.value !== defaultSortBy) count += 1;
        return count;
    });

    let highlightTimer: number | null = null;

    watch(filtersOpen, (open) => {
        if (!open) return;
        draftStatuses.value = [...appliedStatuses.value];
        draftPriorities.value = [...appliedPriorities.value];
        draftSearchTerm.value = appliedSearchTerm.value;
        draftEnvironmentTerm.value = appliedEnvironmentTerm.value;
        draftSortBy.value = appliedSortBy.value;
    });

    onBeforeUnmount(() => {
        if (highlightTimer) {
            window.clearTimeout(highlightTimer);
        }
    });

    function setFiltersOpen(value: boolean) {
        filtersOpen.value = value;
    }

    function setDraftStatuses(value: string[]) {
        draftStatuses.value = value;
    }

    function setDraftPriorities(value: string[]) {
        draftPriorities.value = value;
    }

    function setDraftSearchTerm(value: string) {
        draftSearchTerm.value = value;
    }

    function setDraftEnvironmentTerm(value: string) {
        draftEnvironmentTerm.value = value;
    }

    function setDraftSortBy(value: string) {
        draftSortBy.value = value;
    }

    function highlightTask(taskId: number) {
        highlightedTaskId.value = taskId;
        if (highlightTimer) window.clearTimeout(highlightTimer);
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
                sort_by: appliedSortBy.value,
            };

            const query = appliedSearchTerm.value.trim();
            if (query) params.search = query;

            const environment = appliedEnvironmentTerm.value.trim();
            if (environment) params.environment = environment;

            if (appliedStatuses.value.length && appliedStatuses.value.length < statusOptions.length) {
                params.status = appliedStatuses.value;
            }

            if (appliedPriorities.value.length && appliedPriorities.value.length < priorityOptions.length) {
                params.priority = appliedPriorities.value;
            }

            const response = await axios.get('/shift/api/tasks', { params });

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
        draftStatuses.value = [...defaultStatuses];
        draftPriorities.value = priorityOptions.map((option) => option.value);
        draftSearchTerm.value = '';
        draftEnvironmentTerm.value = '';
        draftSortBy.value = defaultSortBy;

        appliedStatuses.value = [...draftStatuses.value];
        appliedPriorities.value = [...draftPriorities.value];
        appliedSearchTerm.value = draftSearchTerm.value;
        appliedEnvironmentTerm.value = draftEnvironmentTerm.value;
        appliedSortBy.value = draftSortBy.value;

        currentPage.value = 1;
        void fetchTasks();
    }

    function applyFilters() {
        appliedStatuses.value = [...draftStatuses.value];
        appliedPriorities.value = [...draftPriorities.value];
        appliedSearchTerm.value = draftSearchTerm.value;
        appliedEnvironmentTerm.value = draftEnvironmentTerm.value;
        appliedSortBy.value = draftSortBy.value;

        currentPage.value = 1;
        void fetchTasks();
        filtersOpen.value = false;
    }

    function selectAllStatuses() {
        draftStatuses.value = statusOptions.map((option) => option.value);
    }

    function selectAllPriorities() {
        draftPriorities.value = priorityOptions.map((option) => option.value);
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
        tasks,
        totalTasks,
        loading,
        error,
        deleteLoading,
        filtersOpen,
        currentPage,
        lastPage,
        from,
        to,
        highlightedTaskId,
        statusOptions,
        priorityOptions,
        sortByOptions,
        draftStatuses,
        draftPriorities,
        draftSearchTerm,
        draftEnvironmentTerm,
        draftSortBy,
        activeFilterCount,
        setFiltersOpen,
        setDraftStatuses,
        setDraftPriorities,
        setDraftSearchTerm,
        setDraftEnvironmentTerm,
        setDraftSortBy,
        highlightTask,
        fetchTasks,
        resetFilters,
        applyFilters,
        selectAllStatuses,
        selectAllPriorities,
        goToPage,
        deleteTask,
        getTaskEnvironmentLabel,
    };
}
