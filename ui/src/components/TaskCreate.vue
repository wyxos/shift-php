<script setup lang="ts">
import axios from '@/axios-config';
import TaskCreateForm from '@shared/components/TaskCreateForm.vue';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@shift/ui/card';
import { Plus } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { getRuntimeAppEnvironment } from '../lib/runtime-config';

const uploadEndpoints = {
    init: '/shift/api/attachments/upload-init',
    status: '/shift/api/attachments/upload-status',
    chunk: '/shift/api/attachments/upload-chunk',
    complete: '/shift/api/attachments/upload-complete',
};

const removeTempUrl = '/shift/api/attachments/remove-temp';
const aiImproveUrl = '/shift/api/ai/improve';
const aiImproveEnabled = Boolean(window.shiftConfig?.aiEnabled);

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

const isSubmitDisabled = computed(() => loading.value || isEditorUploading.value);

function updateTaskDraft(value: { title: string; description: string; priority: string }) {
    newTask.value = value;
}

async function createTask() {
    createError.value = null;
    loading.value = true;

    try {
        const source_url = window.location.origin;
        const environment = getRuntimeAppEnvironment();

        const payload = {
            title: newTask.value.title,
            description: newTask.value.description,
            priority: newTask.value.priority,
            source_url,
            environment,
            temp_identifier: tempIdentifier.value,
        };

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
        <CardHeader>
            <div>
                <CardTitle>Create Task</CardTitle>
                <p class="text-muted-foreground text-sm">Add a new task to your project queue.</p>
            </div>
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
                    <CardFooter class="flex justify-end gap-2 p-0 pt-2">
                        <Button variant="outline" type="button" @click="cancel">Cancel</Button>
                        <Button :disabled="isSubmitDisabled" variant="default" type="submit">
                            <Plus class="mr-2 h-4 w-4" />
                            {{ loading ? 'Creating...' : 'Create' }}
                        </Button>
                    </CardFooter>
                </template>
            </TaskCreateForm>
        </CardContent>
    </Card>
</template>
