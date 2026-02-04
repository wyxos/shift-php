<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from '../axios-config';
import { X, Plus } from 'lucide-vue-next';
import { Button } from '@shift/ui/button';
import { Input } from '@shift/ui/input';
import { Label } from '@shift/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@shift/ui/card';
import Select from './ui/select.vue';
import FormItem from './ui/form-item.vue';
import ShiftEditor from '@shared/components/ShiftEditor.vue';

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

        // Get the environment from the config or default to 'production'
        const environment = import.meta.env.VITE_APP_ENV || 'production';

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

        router.push({ name: 'task-list' });
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
            <Button
                variant="outline"
                size="sm"
                @click="cancel"
                title="Cancel"
            >
                <X class="h-4 w-4" />
            </Button>
        </CardHeader>

        <CardContent>
            <form class="space-y-3" @submit.prevent="createTask">
            <FormItem>
                <Label>Title</Label>
                <Input v-model="newTask.title" required />
            </FormItem>
            <FormItem>
                <Label>Priority</Label>
                <Select v-model="newTask.priority">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </Select>
            </FormItem>
            <FormItem>
                <Label>Description</Label>
                <ShiftEditor
                    v-model="newTask.description"
                    :temp-identifier="tempIdentifier"
                    :min-height="180"
                    :axios-instance="axios"
                    :upload-endpoints="uploadEndpoints"
                    :remove-temp-url="removeTempUrl"
                    :resolve-temp-url="resolveTempUrl"
                    @uploading="isEditorUploading = $event"
                />
            </FormItem>
            <FormItem v-if="createError" :error="createError"></FormItem>
            <FormItem>
                <Button :disabled="loading || isEditorUploading" variant="default" class="mt-2" type="submit" title="Create">
                    <Plus class="h-4 w-4 mr-1" />
                    {{ loading ? 'Creating...' : 'Create' }}
                </Button>
                <Button
                    :disabled="loading"
                    variant="outline"
                    class="ml-2"
                    type="button"
                    @click="cancel"
                    title="Cancel"
                >
                    <X class="h-4 w-4 mr-1" />
                    Cancel
                </Button>
            </FormItem>
        </form>
        </CardContent>
    </Card>
</template>
