<script lang="ts" setup>
import axios from '@/axios-config';
import ShiftEditor from '@shared/components/ShiftEditor.vue';
import TaskCollaboratorField from '@shared/components/TaskCollaboratorField.vue';
import type { TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { getTaskCreatorEmail, getTaskCreatorName, getTaskEnvironment } from '@shared/tasks/metadata';
import { getPriorityLabel, type TaskFilterOption } from '@shared/tasks/presentation';
import { renderRichContent } from '@shared/tasks/rich-content';
import { formatThreadTime } from '@shared/tasks/thread';
import { Button } from '@shift/ui/button';
import { ButtonGroup } from '@shift/ui/button-group';
import { Input } from '@shift/ui/input';
import { Label } from '@shift/ui/label';
import { computed } from 'vue';
import { aiImproveUrl, getTaskListAiImproveEnabled, removeTempUrl, resolveTempUrl, taskListUploadEndpoints } from './editor-config';
import type { TaskAttachment, TaskDetail } from './types';

interface EditFormModel {
    title: string;
    priority: string;
    status: string;
    description: string;
    collaborators: TaskCollaboratorSelection;
}

interface Props {
    editTask: TaskDetail;
    editLoading: boolean;
    editUploading: boolean;
    editForm: EditFormModel;
    isOwner: boolean;
    canManageCollaborators: boolean;
    statusOptions: TaskFilterOption[];
    priorityOptions: TaskFilterOption[];
    taskAttachments: TaskAttachment[];
    editTempIdentifier: string;
    editMobilePane: 'details' | 'comments';
    setEditUploading: (value: boolean) => void;
    setEditTitle: (value: string) => void;
    setEditPriority: (value: string) => void;
    setEditStatus: (value: string) => void;
    setEditDescription: (value: string) => void;
    updateEditCollaborators: (value: TaskCollaboratorSelection) => void;
    removeAttachmentFromTask: (attachmentId: number) => void;
}

const props = defineProps<Props>();
const aiImproveEnabled = getTaskListAiImproveEnabled();

const titleModel = computed({
    get: () => props.editForm.title,
    set: (value: string) => props.setEditTitle(value),
});

const statusModel = computed({
    get: () => props.editForm.status,
    set: (value: string) => props.setEditStatus(value),
});

const priorityModel = computed({
    get: () => props.editForm.priority,
    set: (value: string) => props.setEditPriority(value),
});

const descriptionModel = computed({
    get: () => props.editForm.description,
    set: (value: string) => props.setEditDescription(value),
});

const visibleStatusOptions = computed(() => props.statusOptions.filter((option) => option.value !== 'closed'));
const editTaskCreatorLabel = computed(() => getTaskCreatorName(props.editTask) ?? getTaskCreatorEmail(props.editTask) ?? 'Unknown');
const editTaskEnvironmentLabel = computed(() => getTaskEnvironment(props.editTask) ?? 'Unknown');
</script>

<template>
    <div :class="[editMobilePane === 'comments' ? 'hidden lg:block' : 'block', 'space-y-6 pr-1 lg:min-h-0 lg:overflow-y-auto']">
        <div class="border-muted-foreground/20 bg-muted/10 grid gap-2 rounded-lg border p-3 text-xs">
            <div v-if="editTask.created_at" class="text-muted-foreground" data-testid="edit-task-created-at">
                Created {{ formatThreadTime(editTask.created_at) }}
            </div>
            <div v-if="editTask.updated_at" class="text-muted-foreground" data-testid="edit-task-updated-at">
                Updated {{ formatThreadTime(editTask.updated_at) }}
            </div>
            <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Environment</span>
                <span class="text-foreground font-medium" data-testid="edit-task-environment">{{ editTaskEnvironmentLabel }}</span>
            </div>
            <div class="flex items-center justify-between gap-2">
                <span class="text-muted-foreground">Created by</span>
                <span class="text-foreground font-medium" data-testid="edit-task-created-by">{{ editTaskCreatorLabel }}</span>
            </div>
        </div>

        <div class="space-y-2">
            <Label class="text-muted-foreground">Task</Label>
            <template v-if="isOwner">
                <Input v-model="titleModel" placeholder="Short, descriptive title" required />
            </template>
            <template v-else>
                <div class="border-muted-foreground/30 bg-muted/10 text-foreground rounded-md border border-dashed p-3 text-sm">
                    {{ editTask.title }}
                </div>
            </template>
        </div>

        <div class="space-y-2">
            <Label class="text-muted-foreground">Status</Label>
            <ButtonGroup
                v-model="statusModel"
                aria-label="Task status"
                test-id-prefix="task-status"
                :disabled="editLoading || editUploading"
                :options="visibleStatusOptions"
                :columns="2"
                class="xl:grid-cols-4"
            />
        </div>

        <div class="space-y-2">
            <Label class="text-muted-foreground">Priority</Label>
            <template v-if="isOwner">
                <ButtonGroup v-model="priorityModel" aria-label="Task priority" test-id-prefix="task-priority" :options="priorityOptions" :columns="3" />
            </template>
            <template v-else>
                <div class="border-muted-foreground/30 bg-muted/10 text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    {{ getPriorityLabel(editTask.priority) }}
                </div>
            </template>
        </div>

        <div class="space-y-2">
            <Label class="text-muted-foreground">Description</Label>
            <template v-if="isOwner">
                <ShiftEditor
                    v-model="descriptionModel"
                    :axios-instance="axios"
                    :enable-ai-improve="aiImproveEnabled"
                    :ai-improve-url="aiImproveUrl"
                    :remove-temp-url="removeTempUrl"
                    :resolve-temp-url="resolveTempUrl"
                    :temp-identifier="editTempIdentifier"
                    :upload-endpoints="taskListUploadEndpoints"
                    placeholder="Update the task details and drag files inline."
                    @uploading="setEditUploading"
                />
            </template>
            <template v-else>
                <div class="border-muted-foreground/30 bg-muted/10 text-foreground rounded-lg border p-4 text-sm">
                    <div
                        v-if="editTask.description"
                        class="tiptap shift-rich [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm [&_img.editor-tile]:aspect-square [&_img.editor-tile]:w-[200px] [&_img.editor-tile]:max-w-[200px] [&_img.editor-tile]:object-cover"
                        v-html="renderRichContent(editTask.description)"
                    ></div>
                    <div v-else class="text-muted-foreground">No description provided.</div>
                </div>
            </template>
        </div>

        <div class="space-y-2">
            <TaskCollaboratorField
                :model-value="editForm.collaborators"
                :disabled="editLoading || editUploading"
                lookup-url="/shift/api/task-collaborators"
                internal-label="SHIFT Team"
                internal-description="Collaborators from the SHIFT portal for this project."
                external-label="Project Users"
                external-description="Users from this app who should be able to access the task."
                :read-only="!canManageCollaborators"
                @update:model-value="updateEditCollaborators"
            />
        </div>

        <div class="space-y-2">
            <Label class="text-muted-foreground">Attachments</Label>
            <div v-if="taskAttachments.length" class="space-y-2">
                <div
                    v-for="attachment in taskAttachments"
                    :key="attachment.id"
                    class="border-muted-foreground/20 bg-muted/10 text-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                    <a :href="attachment.url" class="hover:text-foreground min-w-0 flex-1 truncate transition" rel="noreferrer" target="_blank">
                        {{ attachment.original_filename }}
                    </a>
                    <Button v-if="isOwner" size="sm" type="button" variant="outline" @click="removeAttachmentFromTask(attachment.id)">
                        Remove
                    </Button>
                </div>
            </div>
            <div v-else class="border-muted-foreground/30 bg-muted/10 text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                No attachments available
            </div>
        </div>
    </div>
</template>
