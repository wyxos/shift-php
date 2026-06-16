import axios from '@/axios-config';
import { getTaskEnvironment } from '@shared/tasks/metadata';
import { getRequirementStatusOptions } from '@shared/tasks/presentation';
import { useTaskFilterState } from '@shared/tasks/useTaskFilterState';
import { computed, onBeforeUnmount, ref, unref, type MaybeRef } from 'vue';
import type { Task } from './types';

type UseTaskListListingOptions = {
    endpoint?: MaybeRef<string>;
};

export function useTaskListListing(options: UseTaskListListingOptions = {}) {
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

    const taskFilters = useTaskFilterState({
        includeClosed: true,
        completedStatuses: ['completed', 'closed'],
    });
    const requirementFilters = useTaskFilterState({
        statusOptions: getRequirementStatusOptions(),
        completedStatuses: [],
    });
    const isRequirementsEndpoint = computed(() => (unref(options.endpoint) ?? '/shift/api/tasks').includes('/requirements'));
    const activeFilters = computed(() => (isRequirementsEndpoint.value ? requirementFilters : taskFilters));
    const activeFilterCount = computed(() => activeFilters.value.activeFilterCount.value);
    const draftStatuses = computed(() => activeFilters.value.draftStatuses.value);
    const draftPriorities = computed(() => activeFilters.value.draftPriorities.value);
    const draftSearchTerm = computed(() => activeFilters.value.draftSearchTerm.value);
    const draftEnvironmentTerm = computed(() => activeFilters.value.draftEnvironmentTerm.value);
    const draftSortBy = computed(() => activeFilters.value.draftSortBy.value);
    const statusOptions = computed(() => activeFilters.value.statusOptions);
    const priorityOptions = computed(() => activeFilters.value.priorityOptions);
    const sortByOptions = computed(() => activeFilters.value.sortByOptions);

    let highlightTimer: number | null = null;

    onBeforeUnmount(() => {
        if (highlightTimer) {
            window.clearTimeout(highlightTimer);
        }
    });

    function setFiltersOpen(value: boolean) {
        activeFilters.value.filtersOpen.value = value;
    }

    function setDraftStatuses(value: string[]) {
        activeFilters.value.draftStatuses.value = value;
    }

    function setDraftPriorities(value: string[]) {
        activeFilters.value.draftPriorities.value = value;
    }

    function setDraftSearchTerm(value: string) {
        activeFilters.value.draftSearchTerm.value = value;
    }

    function setDraftEnvironmentTerm(value: string) {
        activeFilters.value.draftEnvironmentTerm.value = value;
    }

    function setDraftSortBy(value: string) {
        activeFilters.value.draftSortBy.value = value;
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
            const filters = activeFilters.value;
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

            const response = await axios.get(unref(options.endpoint) ?? '/shift/api/tasks', {
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
        activeFilters.value.resetFilters();
        currentPage.value = 1;
        void fetchTasks();
    }

    function applyFilters() {
        activeFilters.value.applyDraftToApplied();
        currentPage.value = 1;
        void fetchTasks();
        activeFilters.value.filtersOpen.value = false;
    }

    function goToPage(page: number) {
        const next = Math.max(1, Math.min(lastPage.value, page));
        if (next === currentPage.value) return;
        currentPage.value = next;
        void fetchTasks();
    }

    async function deleteTask(taskId: number) {
        deleteLoading.value = taskId;
        error.value = null;

        try {
            await axios.delete(`/shift/api/tasks/${taskId}`);
            tasks.value = tasks.value.filter((task) => task.id !== taskId);
            totalTasks.value = Math.max(totalTasks.value - 1, 0);
            return true;
        } catch (e: any) {
            error.value = e.response?.data?.error || e.message || 'Failed to delete task';
            deleteLoading.value = null;
            return false;
        }
    }

    function getTaskEnvironmentLabel(task: Task): string {
        return getTaskEnvironment(task) ?? 'Unknown';
    }

    return {
        activeFilterCount,
        applyFilters,
        currentPage,
        deleteLoading,
        deleteTask,
        draftEnvironmentTerm,
        draftPriorities,
        draftSearchTerm,
        draftSortBy,
        draftStatuses,
        error,
        fetchTasks,
        filtersOpen: computed(() => activeFilters.value.filtersOpen.value),
        from,
        getTaskEnvironmentLabel,
        goToPage,
        highlightedTaskId,
        highlightTask,
        lastPage,
        loading,
        priorityOptions,
        resetFilters,
        selectAllPriorities: () => activeFilters.value.selectAllPriorities(),
        selectAllStatuses: () => activeFilters.value.selectAllStatuses(),
        setDraftEnvironmentTerm,
        setDraftPriorities,
        setDraftSearchTerm,
        setDraftSortBy,
        setDraftStatuses,
        setFiltersOpen,
        sortByOptions,
        statusOptions,
        tasks,
        to,
        totalTasks,
    };
}
