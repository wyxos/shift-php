<script lang="ts" setup>
import axios from '@/axios-config';
import ShiftEditor from '@shared/components/ShiftEditor.vue';
import TaskCollaboratorField from '@shared/components/TaskCollaboratorField.vue';
import { emptyTaskCollaborators, type TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { Button } from '@shift/ui/button';
import { Input } from '@shift/ui/input';
import { Label } from '@shift/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@shift/ui/sheet';
import { Plus, Trash2, Users } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { aiImproveUrl, getTaskListAiImproveEnabled, removeTempUrl, resolveTempUrl, taskListUploadEndpoints } from './editor-config';

type RequirementDraft = {
    key: number;
    title: string;
    description: string;
    tempIdentifier: string;
    collaborators: TaskCollaboratorSelection;
};

type RequirementPackPayload = {
    title: string;
    items: Array<{
        title: string;
        description: string;
        temp_identifier: string;
        internal_collaborator_ids?: number[];
        external_collaborators?: Array<{
            id: string | number;
            name: string;
            email: string;
        }>;
    }>;
    internal_collaborator_ids?: number[];
    external_collaborators?: Array<{
        id: string | number;
        name: string;
        email: string;
    }>;
};

const props = defineProps<{
    open: boolean;
    loading: boolean;
    error: string | null;
}>();

const emit = defineEmits<{
    submit: [payload: RequirementPackPayload];
    cancel: [];
}>();

const packTitle = ref('');
const nextKey = ref(1);
const items = ref<RequirementDraft[]>([]);
const collaboratorsApplyPerRequirement = ref(false);
const globalCollaborators = ref<TaskCollaboratorSelection>(emptyTaskCollaborators());
const aiImproveEnabled = getTaskListAiImproveEnabled();

const appSlug = computed(() => slugify(window.shiftConfig?.appName || 'project'));
const timestampSlug = computed(() => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
});
const groupNamePlaceholder = computed(() => `${timestampSlug.value}-${appSlug.value}-requirements`);

const completeItems = computed(() =>
    items.value.map((item) => ({
        ...item,
        title: item.title.trim(),
        description: item.description.trim(),
    })),
);
const canSubmit = computed(
    () =>
        packTitle.value.trim().length > 0 &&
        completeItems.value.length > 0 &&
        completeItems.value.every((item) => item.title.length > 0 && item.description.length > 0),
);

function slugify(value: string): string {
    return (
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'project'
    );
}

function newRequirementDraft(): RequirementDraft {
    return {
        key: nextKey.value,
        title: '',
        description: '',
        tempIdentifier: `requirement-${Date.now()}-${nextKey.value}`,
        collaborators: emptyTaskCollaborators(),
    };
}

function addItem() {
    items.value = [...items.value, newRequirementDraft()];
    nextKey.value += 1;
}

function removeItem(key: number) {
    items.value = items.value.filter((item) => item.key !== key);
}

function updateItem(index: number, field: 'title' | 'description', value: string) {
    const item = items.value[index];
    if (!item) return;

    items.value = items.value.map((candidate, candidateIndex) => (candidateIndex === index ? { ...candidate, [field]: value } : candidate));
}

function updateItemCollaborators(index: number, collaborators: TaskCollaboratorSelection) {
    const item = items.value[index];
    if (!item) return;

    items.value = items.value.map((candidate, candidateIndex) => (candidateIndex === index ? { ...candidate, collaborators } : candidate));
}

function collaboratorPayload(collaborators: TaskCollaboratorSelection) {
    return {
        internal_collaborator_ids: collaborators.internal.map((collaborator) => Number(collaborator.id)),
        external_collaborators: collaborators.external.map((collaborator) => ({
            id: collaborator.id,
            name: collaborator.name,
            email: collaborator.email ?? '',
        })),
    };
}

function toggleCollaboratorMode() {
    collaboratorsApplyPerRequirement.value = !collaboratorsApplyPerRequirement.value;
}

function handleOpenChange(open: boolean) {
    if (!open) {
        emit('cancel');
    }
}

function submit() {
    if (!canSubmit.value) return;

    const itemPayloads = completeItems.value.map((item) => ({
        title: item.title,
        description: item.description,
        temp_identifier: item.tempIdentifier,
        ...(collaboratorsApplyPerRequirement.value ? collaboratorPayload(item.collaborators) : {}),
    }));
    const globalCollaboratorPayload = collaboratorsApplyPerRequirement.value ? {} : collaboratorPayload(globalCollaborators.value);

    emit('submit', {
        title: packTitle.value.trim(),
        items: itemPayloads,
        ...globalCollaboratorPayload,
    });
}
</script>

<template>
    <Sheet :open="props.open" @update:open="handleOpenChange">
        <SheetContent class="flex h-full flex-col p-0" side="right" width-preset="task">
            <form class="flex h-full min-h-0 flex-col" data-testid="requirement-pack-form" @submit.prevent="submit">
                <SheetHeader class="p-0">
                    <div class="px-6 pt-6 pb-3">
                        <SheetTitle>New requirements</SheetTitle>
                        <SheetDescription class="text-muted-foreground mt-1 text-sm">
                            Submit requirement drafts for SHIFT review.
                        </SheetDescription>
                    </div>
                </SheetHeader>

                <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6">
                    <div>
                        <Label class="sr-only" for="requirement-pack-title">Group name</Label>
                        <Input
                            id="requirement-pack-title"
                            v-model="packTitle"
                            aria-label="Group name"
                            data-testid="requirement-pack-title"
                            :placeholder="groupNamePlaceholder"
                            required
                        />
                    </div>

                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex items-center gap-2 text-sm font-medium">
                            <Users class="text-muted-foreground h-4 w-4" />
                            Collaborators
                        </div>
                        <button
                            type="button"
                            role="switch"
                            :aria-checked="collaboratorsApplyPerRequirement"
                            class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm shadow-xs outline-none transition-colors focus-visible:ring-[3px]"
                            data-testid="requirement-collaborator-mode-toggle"
                            @click="toggleCollaboratorMode"
                        >
                            <span
                                :class="[
                                    collaboratorsApplyPerRequirement ? 'bg-primary' : 'bg-muted-foreground/40',
                                    'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
                                ]"
                                aria-hidden="true"
                            >
                                <span
                                    :class="[
                                        collaboratorsApplyPerRequirement ? 'translate-x-4' : 'translate-x-0.5',
                                        'bg-background absolute top-0.5 h-4 w-4 rounded-full shadow transition-transform',
                                    ]"
                                />
                            </span>
                            <span data-testid="requirement-collaborator-mode-label">
                                {{ collaboratorsApplyPerRequirement ? 'Per requirement' : 'All requirements' }}
                            </span>
                        </button>
                    </div>

                    <TaskCollaboratorField
                        v-if="!collaboratorsApplyPerRequirement"
                        v-model="globalCollaborators"
                        lookup-url="/shift/api/task-collaborators"
                        internal-label="Organisation"
                        internal-description="Users with access in SHIFT."
                        external-label="Team"
                        :external-badge-label="null"
                        external-description="Users with access from this portal."
                    />

                    <div class="space-y-5" data-testid="requirement-items">
                        <div v-if="items.length === 0" class="flex justify-start">
                            <Button data-testid="add-requirement-item-empty" type="button" variant="outline" @click="addItem">
                                <Plus class="mr-2 h-4 w-4" />
                                Add Requirement
                            </Button>
                        </div>

                        <section
                            v-for="(item, index) in items"
                            :key="item.key"
                            class="space-y-4 border-t pt-5 first:border-t-0 first:pt-0"
                            :data-testid="`requirement-item-${index}`"
                        >
                            <div v-if="items.length > 1" class="flex items-center justify-between gap-3">
                                <h3 class="text-sm font-medium">Requirement {{ index + 1 }}</h3>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    :data-testid="`remove-requirement-item-${index}`"
                                    @click="removeItem(item.key)"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            </div>

                            <div class="space-y-2">
                                <Label class="text-muted-foreground" :for="`requirement-item-title-${index}`">Task name</Label>
                                <Input
                                    :id="`requirement-item-title-${index}`"
                                    :model-value="item.title"
                                    :data-testid="`requirement-item-title-${index}`"
                                    placeholder="Short requirement title"
                                    required
                                    @update:model-value="updateItem(index, 'title', String($event))"
                                />
                            </div>

                            <div class="space-y-2">
                                <Label class="text-muted-foreground">Description</Label>
                                <ShiftEditor
                                    :model-value="item.description"
                                    :temp-identifier="item.tempIdentifier"
                                    :min-height="180"
                                    :axios-instance="axios"
                                    :enable-ai-improve="aiImproveEnabled"
                                    :upload-endpoints="taskListUploadEndpoints"
                                    :remove-temp-url="removeTempUrl"
                                    :ai-improve-url="aiImproveUrl"
                                    :resolve-temp-url="resolveTempUrl"
                                    placeholder="Describe what you need, questions, examples, or constraints."
                                    :sendable="false"
                                    :data-testid="`requirement-item-description-${index}`"
                                    @update:model-value="updateItem(index, 'description', String($event))"
                                />
                            </div>

                            <TaskCollaboratorField
                                v-if="collaboratorsApplyPerRequirement"
                                :model-value="item.collaborators"
                                lookup-url="/shift/api/task-collaborators"
                                internal-label="Organisation"
                                internal-description="Users with access in SHIFT."
                                external-label="Team"
                                :external-badge-label="null"
                                external-description="Users with access from this portal."
                                @update:model-value="updateItemCollaborators(index, $event)"
                            />
                        </section>

                        <div v-if="items.length > 0" class="flex justify-start">
                            <Button data-testid="add-requirement-item" type="button" variant="outline" @click="addItem">
                                <Plus class="mr-2 h-4 w-4" />
                                Add Requirement
                            </Button>
                        </div>
                    </div>

                    <div v-if="error" class="text-destructive text-sm">{{ error }}</div>
                </div>

                <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
                    <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
                    <Button data-testid="submit-requirement-pack" type="submit" :disabled="loading || !canSubmit">
                        {{ loading ? 'Submitting...' : 'Submit Requirements' }}
                    </Button>
                </SheetFooter>
            </form>
        </SheetContent>
    </Sheet>
</template>
