<script lang="ts" setup>
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import axios from '../axios-config';
import { X, Trash2, Plus } from 'lucide-vue-next';
import Button from './ui/button.vue';
import Input from './ui/input.vue';
import Select from './ui/select.vue';
import Label from './ui/label.vue';
import FormItem from './ui/form-item.vue';
import Card from './ui/card.vue';
import CardHeader from './ui/card-header.vue';
import CardTitle from './ui/card-title.vue';
import CardContent from './ui/card-content.vue';

const router = useRouter();
const createError = ref<string | null>(null);
const loading = ref(false);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);
const uploadedFiles = ref<any[]>([]);
const tempIdentifier = ref(Date.now().toString());

// Description Editor reference
const descriptionEditorRef = shallowRef<Editor | null>(null);
const descriptionEditorContainerRef = ref<HTMLElement | null>(null);

const newTask = ref({
    title: '',
    description: '',
    priority: 'medium',
});

async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    isUploading.value = true;
    uploadError.value = null;

    try {
        const formData = new FormData();
        formData.append('temp_identifier', tempIdentifier.value);

        // Add all files to the formData
        Array.from(input.files).forEach((file, index) => {
            formData.append(`attachments[${index}]`, file);
        });

        // Upload files immediately
        const response = await axios.post('/shift/api/attachments/upload-multiple', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        // Add the uploaded files to our list
        if (response.data.files && Array.isArray(response.data.files)) {
            uploadedFiles.value = [...uploadedFiles.value, ...response.data.files];
        }
    } catch (error: any) {
        uploadError.value = error.response?.data?.message || 'Error uploading files';
        console.error('Upload error:', error);
    } finally {
        isUploading.value = false;
        // Clear the file input
        input.value = '';
    }
}

// Remove a temporary file
async function removeFile(file: any) {
    try {
        await axios.delete('/shift/api/attachments/remove-temp', {
            params: { path: file.path },
        });

        // Remove from the list
        uploadedFiles.value = uploadedFiles.value.filter((f) => f.path !== file.path);
    } catch (error) {
        console.error('Error removing file:', error);
    }
}

async function createTask() {
    createError.value = null;
    loading.value = true;

    try {
        // Get the current URL for the source_url
        const source_url = window.location.origin;

        // Get the environment from the config or default to 'production'
        const environment = import.meta.env.VITE_APP_ENV || 'production';

        // Get description content from the editor
        const descriptionContent = descriptionEditorRef.value?.getMarkdown() || '';

        // Create the payload with task data and temp_identifier for attachments
        const payload = {
            title: newTask.value.title,
            description: descriptionContent,
            priority: newTask.value.priority,
            source_url,
            environment,
            temp_identifier: uploadedFiles.value.length > 0 ? tempIdentifier.value : undefined,
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

// Initialize the editor when component is mounted
onMounted(() => {
    // Initialize Toast Editor after DOM is ready
    setTimeout(() => {
        if (descriptionEditorContainerRef.value) {
            descriptionEditorRef.value = new Editor({
                el: descriptionEditorContainerRef.value,
                height: 'auto',
                initialEditType: 'markdown',
                previewStyle: 'tab',
                toolbarItems: [
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task', 'indent', 'outdent'],
                    ['table', 'link'],
                    ['code', 'codeblock'],
                ],
                hideModeSwitch: true, // Only allow markdown mode
            });

            // Add event listener to adjust height based on content
            const editorEl = descriptionEditorContainerRef.value.querySelector('.toastui-editor-main .ProseMirror');
            if (editorEl) {
                const observer = new MutationObserver(() => {
                    const editorHeight = editorEl.scrollHeight;
                    editorEl.style.height = 'auto';
                    editorEl.style.maxHeight = '400px';
                    editorEl.style.overflowY = editorHeight > 400 ? 'auto' : 'hidden';
                });

                observer.observe(editorEl, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
        }
    }, 0);
});

// Clean up the editor when component is unmounted
onBeforeUnmount(() => {
    if (descriptionEditorRef.value) {
        descriptionEditorRef.value.destroy();
        descriptionEditorRef.value = null;
    }
});
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
                <Label>Description</Label>
                <div ref="descriptionEditorContainerRef" class="w-full rounded border" style="min-height: 250px"></div>
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
                <Label>Attachments</Label>
                <input :disabled="isUploading" class="w-full rounded border px-2 py-1" multiple type="file" @change="handleFileChange" />

                <!-- Upload error message -->
                <div v-if="uploadError" class="mt-1 text-sm text-red-500">{{ uploadError }}</div>

                <!-- Loading indicator -->
                <div v-if="isUploading" class="mt-1 text-sm text-blue-500">Uploading files...</div>

                <!-- List of uploaded files -->
                <div v-if="uploadedFiles.length > 0" class="mt-3">
                    <p class="text-sm text-gray-600">Uploaded files:</p>
                    <ul class="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200">
                        <li v-for="file in uploadedFiles" :key="file.path" class="flex items-center justify-between px-3 py-2 text-sm">
                            <div class="flex items-center">
                                <svg class="mr-2 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        clip-rule="evenodd"
                                        d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                                        fill-rule="evenodd"
                                    />
                                </svg>
                                <span class="truncate">{{ file.original_filename }}</span>
                            </div>
                            <Button :disabled="loading" variant="destructive" size="sm" type="button" @click="removeFile(file)" title="Remove">
                                <Trash2 class="h-4 w-4" />
                            </Button>
                        </li>
                    </ul>
                </div>
            </FormItem>
            <FormItem v-if="createError" :error="createError"></FormItem>
            <FormItem>
                <Button :disabled="loading" variant="primary" class="mt-2" type="submit" title="Create">
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
