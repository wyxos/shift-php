<script lang="ts" setup>
import TaskCreateForm from '@shared/components/TaskCreateForm.vue';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shift/ui/card';
import { Plus, X } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import axios from '../axios-config';
import { getRuntimeAppEnvironment } from '../lib/runtime-config';

const router = useRouter();
const createError = ref<string | null>(null);
const loading = ref(false);
const tempIdentifier = ref(Date.now().toString());
const isEditorUploading = ref(false);

const newTask = ref({
    title: '',
    description: '',
    priority: 'medium',
});

const uploadEndpoints = {
    init: '/shift/api/attachments/upload-init',
    status: '/shift/api/attachments/upload-status',
    chunk: '/shift/api/attachments/upload-chunk',
    complete: '/shift/api/attachments/upload-complete',
};

const removeTempUrl = '/shift/api/attachments/remove-temp';
const aiImproveUrl = '/shift/api/ai/improve';
const aiImproveEnabled = Boolean(window.shiftConfig?.aiEnabled);

function updateTaskDraft(value: { title: string; description: string; priority: string }) {
    newTask.value = value;
}

function resolveTempUrl(data: any): string {
    if (data && data.url) return data.url as string;
    if (data && data.path) {
        const match = String(data.path).match(/^temp_attachments\/([^/]+)\/(.+)$/);
        if (match) {
            return `/shift/api/attachments/temp/${match[1]}/${match[2]}`;
        }
    }
    return '';
}

async function createTask() {
    createError.value = null;
    loading.value = true;

    try {
        // Get the current URL for the source_url
        const source_url = window.location.origin;

        const environment = getRuntimeAppEnvironment();

        // Create the payload with task data and temp_identifier for attachments
        const payload = {
            title: newTask.value.title,
            description: newTask.value.description,
            priority: newTask.value.priority,
            source_url,
            environment,
            temp_identifier: tempIdentifier.value,
        };

        // Create the task using authenticated user information
        await axios.post('/shift/api/tasks', payload);
        toast.success('Task created', { description: 'Your task has been added to the queue.' });

        await router.push({ name: 'task-list' });
    } catch (e: any) {
        createError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

function cancel() {
    router.push({ name: 'task-list' });
}
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>Create Task</CardTitle>
            <Button variant="outline" size="sm" @click="cancel" title="Cancel">
                <X class="h-4 w-4" />
            </Button>
        </CardHeader>

        <CardContent>
            <TaskCreateForm
                :model-value="newTask"
                :temp-identifier="tempIdentifier"
                :axios-instance="axios"
                :enable-ai-improve="aiImproveEnabled"
                :upload-endpoints="uploadEndpoints"
                :remove-temp-url="removeTempUrl"
                :ai-improve-url="aiImproveUrl"
                :resolve-temp-url="resolveTempUrl"
                :error="createError"
                title-label="Title"
                @submit="createTask"
                @update:modelValue="updateTaskDraft"
                @update:uploading="isEditorUploading = $event"
            >
                <template #actions>
                    <div class="flex items-center px-6 pt-2 pb-6">
                        <Button :disabled="loading || isEditorUploading" variant="default" type="submit" title="Create">
                            <Plus class="mr-1 h-4 w-4" />
                            {{ loading ? 'Creating...' : 'Create' }}
                        </Button>
                        <Button :disabled="loading" variant="outline" class="ml-2" type="button" @click="cancel" title="Cancel">
                            <X class="mr-1 h-4 w-4" />
                            Cancel
                        </Button>
                    </div>
                </template>
            </TaskCreateForm>
        </CardContent>
    </Card>
</template>
