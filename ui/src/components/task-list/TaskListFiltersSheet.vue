<script lang="ts" setup>
import { Button } from '@shift/ui/button';
import { ButtonGroup } from '@shift/ui/button-group';
import { Input } from '@shift/ui/input';
import { Label } from '@shift/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@shift/ui/sheet';
import { Filter } from 'lucide-vue-next';
import { computed } from 'vue';
import Badge from '../ui/badge.vue';

type Option = {
    value: string;
    label: string;
};

interface Props {
    open: boolean;
    activeFilterCount: number;
    draftStatuses: string[];
    draftPriorities: string[];
    draftSearchTerm: string;
    draftEnvironmentTerm: string;
    draftSortBy: string;
    statusOptions: Option[];
    priorityOptions: Option[];
    sortByOptions: Option[];
    setOpen: (value: boolean) => void;
    setDraftStatuses: (value: string[]) => void;
    setDraftPriorities: (value: string[]) => void;
    setDraftSearchTerm: (value: string) => void;
    setDraftEnvironmentTerm: (value: string) => void;
    setDraftSortBy: (value: string) => void;
    resetFilters: () => void;
    applyFilters: () => void;
    selectAllStatuses: () => void;
    selectAllPriorities: () => void;
}

const props = defineProps<Props>();

const openModel = computed({
    get: () => props.open,
    set: (value: boolean) => props.setOpen(value),
});

const searchModel = computed({
    get: () => props.draftSearchTerm,
    set: (value: string) => props.setDraftSearchTerm(value),
});

const environmentModel = computed({
    get: () => props.draftEnvironmentTerm,
    set: (value: string) => props.setDraftEnvironmentTerm(value),
});

const statusesModel = computed({
    get: () => props.draftStatuses,
    set: (value: string[]) => props.setDraftStatuses(value),
});

const prioritiesModel = computed({
    get: () => props.draftPriorities,
    set: (value: string[]) => props.setDraftPriorities(value),
});

const sortByModel = computed({
    get: () => props.draftSortBy,
    set: (value: string) => props.setDraftSortBy(value),
});
</script>

<template>
    <Sheet v-model:open="openModel">
        <SheetTrigger as-child>
            <Button data-testid="filters-trigger" size="sm" variant="outline">
                <Filter class="mr-2 h-4 w-4" />
                Filters
                <Badge v-if="activeFilterCount" class="ml-2" variant="secondary">
                    {{ activeFilterCount }}
                </Badge>
            </Button>
        </SheetTrigger>

        <SheetContent class="flex h-full flex-col p-0" side="right">
            <SheetHeader class="p-0">
                <div class="px-6 pt-6 pb-3">
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription class="text-muted-foreground mt-1 text-sm"> Refine your task list in real time. </SheetDescription>
                </div>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
                <div class="space-y-2">
                    <Label class="text-muted-foreground">Search</Label>
                    <Input v-model="searchModel" data-testid="filter-search" placeholder="Search by title" />
                </div>

                <div class="space-y-2">
                    <Label class="text-muted-foreground">Environment</Label>
                    <Input v-model="environmentModel" data-testid="filter-environment" placeholder="e.g. Production" />
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <Label class="text-muted-foreground">Status</Label>
                        <Button size="sm" variant="ghost" @click="selectAllStatuses">All</Button>
                    </div>

                    <div class="grid gap-2">
                        <label v-for="option in statusOptions" :key="option.value" class="flex items-center gap-2 text-sm">
                            <input
                                v-model="statusesModel"
                                :data-testid="`status-${option.value}`"
                                :value="option.value"
                                type="checkbox"
                            />
                            <span>{{ option.label }}</span>
                        </label>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <Label class="text-muted-foreground">Priority</Label>
                        <Button size="sm" variant="ghost" @click="selectAllPriorities">All</Button>
                    </div>

                    <div class="grid gap-2">
                        <label v-for="option in priorityOptions" :key="option.value" class="flex items-center gap-2 text-sm">
                            <input
                                v-model="prioritiesModel"
                                :data-testid="`priority-${option.value}`"
                                :value="option.value"
                                type="checkbox"
                            />
                            <span>{{ option.label }}</span>
                        </label>
                    </div>
                </div>

                <div class="space-y-2">
                    <Label class="text-muted-foreground">Sort By</Label>
                    <ButtonGroup v-model="sortByModel" test-id-prefix="sort-by" aria-label="Sort tasks" :options="sortByOptions" :columns="3" />
                </div>
            </div>

            <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
                <Button data-testid="filters-reset" variant="ghost" @click="resetFilters">Reset</Button>
                <Button data-testid="filters-apply" variant="default" @click="applyFilters">Apply</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
