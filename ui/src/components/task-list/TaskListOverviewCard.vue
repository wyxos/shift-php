<script lang="ts" setup>
import TaskListOverviewPanel from '@shared/components/tasks/TaskListOverviewPanel.vue';
import { Button } from '@shift/ui/button';
import { Plus } from 'lucide-vue-next';
import type { Task } from './types';

type Option = {
    value: string;
    label: string;
};

interface Props {
    tasks: Task[];
    totalTasks: number;
    loading: boolean;
    error: string | null;
    deleteLoading: number | null;
    currentPage: number;
    lastPage: number;
    from: number;
    to: number;
    highlightedTaskId: number | null;
    filtersOpen: boolean;
    activeFilterCount: number;
    draftStatuses: string[];
    draftPriorities: string[];
    draftSearchTerm: string;
    draftEnvironmentTerm: string;
    draftSortBy: string;
    statusOptions: Option[];
    priorityOptions: Option[];
    sortByOptions: Option[];
    getTaskEnvironmentLabel: (task: Task) => string;
    setFiltersOpen: (value: boolean) => void;
    setDraftStatuses: (value: string[]) => void;
    setDraftPriorities: (value: string[]) => void;
    setDraftSearchTerm: (value: string) => void;
    setDraftEnvironmentTerm: (value: string) => void;
    setDraftSortBy: (value: string) => void;
    resetFilters: () => void;
    applyFilters: () => void;
    selectAllStatuses: () => void;
    selectAllPriorities: () => void;
    openCreate: () => void;
    openEdit: (taskId: number) => void | Promise<void>;
    deleteTask: (taskId: number) => void | Promise<void>;
    goToPage: (page: number) => void;
}

const props = defineProps<Props>();
</script>

<template>
    <TaskListOverviewPanel
        :tasks="props.tasks"
        :total-tasks="props.totalTasks"
        :loading="props.loading"
        :error="props.error"
        :delete-loading="props.deleteLoading"
        :current-page="props.currentPage"
        :last-page="props.lastPage"
        :from="props.from"
        :to="props.to"
        :highlighted-task-id="props.highlightedTaskId"
        :filters-open="props.filtersOpen"
        :active-filter-count="props.activeFilterCount"
        :draft-statuses="props.draftStatuses"
        :draft-priorities="props.draftPriorities"
        :draft-search-term="props.draftSearchTerm"
        :draft-environment-term="props.draftEnvironmentTerm"
        :draft-sort-by="props.draftSortBy"
        :status-options="props.statusOptions"
        :priority-options="props.priorityOptions"
        :sort-by-options="props.sortByOptions"
        :get-task-environment-label="props.getTaskEnvironmentLabel"
        :set-filters-open="props.setFiltersOpen"
        :set-draft-statuses="props.setDraftStatuses"
        :set-draft-priorities="props.setDraftPriorities"
        :set-draft-search-term="props.setDraftSearchTerm"
        :set-draft-environment-term="props.setDraftEnvironmentTerm"
        :set-draft-sort-by="props.setDraftSortBy"
        :reset-filters="props.resetFilters"
        :apply-filters="props.applyFilters"
        :select-all-statuses="props.selectAllStatuses"
        :select-all-priorities="props.selectAllPriorities"
        :open-edit="props.openEdit"
        :delete-task="props.deleteTask"
        :go-to-page="props.goToPage"
    >
        <template #actions>
            <Button data-testid="open-create-task" size="sm" variant="default" @click="props.openCreate">
                <Plus class="mr-2 h-4 w-4" />
                Create
            </Button>
        </template>
    </TaskListOverviewPanel>
</template>
