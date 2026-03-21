<script lang="ts" setup>
import { getPriorityBadgeClass, getPriorityLabel, getStatusBadgeClass, getStatusLabel } from '@shared/tasks/presentation';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shift/ui/card';
import { Pencil, Plus, Trash2 } from 'lucide-vue-next';
import TaskListFiltersSheet from './TaskListFiltersSheet.vue';
import type { Task } from './types';
import Badge from '../ui/badge.vue';

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

defineProps<Props>();
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <CardTitle>Tasks</CardTitle>
                <p class="text-muted-foreground text-sm">Default view hides completed and closed tasks.</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <TaskListFiltersSheet
                    :open="filtersOpen"
                    :active-filter-count="activeFilterCount"
                    :draft-statuses="draftStatuses"
                    :draft-priorities="draftPriorities"
                    :draft-search-term="draftSearchTerm"
                    :draft-environment-term="draftEnvironmentTerm"
                    :draft-sort-by="draftSortBy"
                    :status-options="statusOptions"
                    :priority-options="priorityOptions"
                    :sort-by-options="sortByOptions"
                    :set-open="setFiltersOpen"
                    :set-draft-statuses="setDraftStatuses"
                    :set-draft-priorities="setDraftPriorities"
                    :set-draft-search-term="setDraftSearchTerm"
                    :set-draft-environment-term="setDraftEnvironmentTerm"
                    :set-draft-sort-by="setDraftSortBy"
                    :reset-filters="resetFilters"
                    :apply-filters="applyFilters"
                    :select-all-statuses="selectAllStatuses"
                    :select-all-priorities="selectAllPriorities"
                />

                <Button data-testid="open-create-task" size="sm" variant="default" @click="openCreate">
                    <Plus class="mr-2 h-4 w-4" />
                    Create
                </Button>
            </div>
        </CardHeader>

        <CardContent>
            <div class="text-muted-foreground mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>Showing {{ from }} to {{ to }} of {{ totalTasks }} tasks</span>
                <span v-if="activeFilterCount">{{ activeFilterCount }} filter{{ activeFilterCount === 1 ? '' : 's' }} active</span>
            </div>

            <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading...</div>
            <div v-else-if="error" class="text-destructive py-8 text-center">{{ error }}</div>
            <div v-else-if="tasks.length === 0" class="text-muted-foreground py-8 text-center">No tasks found</div>

            <ul v-else class="divide-border divide-y">
                <li
                    v-for="task in tasks"
                    :key="task.id"
                    :class="
                        highlightedTaskId === task.id ? 'ring-offset-background rounded-lg bg-sky-500/10 ring-2 ring-sky-500/40 ring-offset-2' : ''
                    "
                    class="flex flex-col gap-3 py-4 transition sm:flex-row sm:items-center sm:gap-4"
                    data-testid="task-row"
                >
                    <div class="flex-1">
                        <div class="text-card-foreground text-lg font-medium">{{ task.title }}</div>
                        <div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <Badge :class="getStatusBadgeClass(task.status)" :data-testid="`task-status-badge-${task.id}`" variant="outline">
                                {{ getStatusLabel(task.status) }}
                            </Badge>
                            <Badge :class="getPriorityBadgeClass(task.priority)" :data-testid="`task-priority-badge-${task.id}`" variant="outline">
                                {{ getPriorityLabel(task.priority) }}
                            </Badge>
                            <Badge :data-testid="`task-environment-badge-${task.id}`" variant="outline">
                                {{ getTaskEnvironmentLabel(task) }}
                            </Badge>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <Button size="sm" title="Edit" variant="outline" @click="openEdit(task.id)">
                            <Pencil class="h-4 w-4" />
                        </Button>
                        <Button :disabled="deleteLoading === task.id" size="sm" title="Delete" variant="destructive" @click="deleteTask(task.id)">
                            <span v-if="deleteLoading === task.id">Deleting...</span>
                            <Trash2 v-else class="h-4 w-4" />
                        </Button>
                    </div>
                </li>
            </ul>

            <div v-if="lastPage > 1" class="mt-4 flex items-center justify-between border-t pt-4">
                <div class="text-muted-foreground text-xs">Page {{ currentPage }} of {{ lastPage }}</div>
                <div class="flex items-center gap-2">
                    <Button :disabled="loading || currentPage <= 1" size="sm" variant="outline" @click="goToPage(currentPage - 1)">Previous</Button>
                    <Button :disabled="loading || currentPage >= lastPage" size="sm" variant="outline" @click="goToPage(currentPage + 1)">Next</Button>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
