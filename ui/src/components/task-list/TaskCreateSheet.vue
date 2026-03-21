<script lang="ts" setup>
import axios from '@/axios-config';
import TaskCollaboratorField from '@shared/components/TaskCollaboratorField.vue';
import TaskCreateForm from '@shared/components/TaskCreateForm.vue';
import { type TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { Button } from '@shift/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@shift/ui/sheet';
import { Plus } from 'lucide-vue-next';
import { aiImproveUrl, getTaskListAiImproveEnabled, removeTempUrl, resolveTempUrl, taskListUploadEndpoints } from './editor-config';

interface CreateFormModel {
    title: string;
    priority: string;
    description: string;
    collaborators: TaskCollaboratorSelection;
}

interface Props {
    open: boolean;
    form: CreateFormModel;
    tempIdentifier: string;
    loading: boolean;
    uploading: boolean;
    error: string | null;
    setOpen: (value: boolean) => void;
    updateForm: (value: { title: string; priority: string; description: string }) => void;
    updateCollaborators: (value: TaskCollaboratorSelection) => void;
    setUploading: (value: boolean) => void;
    submit: () => void | Promise<void>;
}

defineProps<Props>();

const aiImproveEnabled = getTaskListAiImproveEnabled();
</script>

<template>
    <Sheet :open="open" @update:open="setOpen">
        <SheetContent class="flex h-full flex-col p-0" side="right" width-preset="task">
            <SheetHeader class="p-0">
                <div class="px-6 pt-6 pb-3">
                    <SheetTitle>Create Task</SheetTitle>
                    <SheetDescription class="text-muted-foreground mt-1 text-sm"> Add a new task to your project queue. </SheetDescription>
                </div>
            </SheetHeader>

            <TaskCreateForm
                class="min-h-0 flex-1"
                :model-value="form"
                :temp-identifier="tempIdentifier"
                :axios-instance="axios"
                :enable-ai-improve="aiImproveEnabled"
                :ai-improve-url="aiImproveUrl"
                :remove-temp-url="removeTempUrl"
                :resolve-temp-url="resolveTempUrl"
                :upload-endpoints="taskListUploadEndpoints"
                :error="error"
                @submit="submit"
                @update:modelValue="updateForm"
                @update:uploading="setUploading"
            >
                <TaskCollaboratorField
                    :model-value="form.collaborators"
                    lookup-url="/shift/api/task-collaborators"
                    internal-label="SHIFT Team"
                    internal-description="Collaborators from the SHIFT portal for this project."
                    external-label="Project Users"
                    external-description="Users from this app who should be able to access the task."
                    @update:model-value="updateCollaborators"
                />

                <template #actions>
                    <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
                        <Button type="button" variant="outline" @click="setOpen(false)">Cancel</Button>
                        <Button data-testid="submit-create-task" :disabled="loading || uploading" type="submit" variant="default">
                            <Plus class="mr-2 h-4 w-4" />
                            {{ loading ? 'Creating...' : 'Create' }}
                        </Button>
                    </SheetFooter>
                </template>
            </TaskCreateForm>
        </SheetContent>
    </Sheet>
</template>
