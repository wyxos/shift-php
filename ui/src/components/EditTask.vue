<script lang="ts" setup>
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import { marked } from 'marked';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '../axios-config';
import { X, Trash2, Save, Send } from 'lucide-vue-next';
import Button from './ui/button.vue';
import Input from './ui/input.vue';
import Select from './ui/select.vue';
import Label from './ui/label.vue';
import FormItem from './ui/form-item.vue';
import Skeleton from './ui/skeleton.vue';
import Card from './ui/card.vue';
import CardHeader from './ui/card-header.vue';
import CardTitle from './ui/card-title.vue';
import CardContent from './ui/card-content.vue';

const router = useRouter();
const route = useRoute();
const editError = ref<string | null>(null);
const loading = ref(false);
const fetchLoading = ref(true);
const fetchError = ref<string | null>(null);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);
const uploadedFiles = ref<any[]>([]);
const tempIdentifier = ref(Date.now().toString());
const existingAttachments = ref<any[]>([]);
const deletedAttachmentIds = ref<number[]>([]);

// Thread state
const externalMessages = ref<any[]>([]);
const threadLoading = ref(false);
const threadError = ref<string | null>(null);
const messagesContainerRef = ref<HTMLElement | null>(null);

// Toast Editor references
const messageEditorRef = shallowRef<Editor | null>(null);
const messageEditorContainerRef = ref<HTMLElement | null>(null);

// Description Editor reference
const descriptionEditorRef = shallowRef<Editor | null>(null);
const descriptionEditorContainerRef = ref<HTMLElement | null>(null);

// Thread attachment state
const threadTempIdentifier = ref(Date.now().toString() + '_thread');
const threadAttachments = ref<any[]>([]);
const isThreadUploading = ref(false);
const threadUploadError = ref<string | null>(null);

// Function to render markdown content
function renderMarkdown(content: string) {
    return marked(content);
}

const editTaskData = ref({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
});

async function fetchTask() {
    const taskId = route.params.id;
    if (!taskId) {
        router.push({ name: 'task-list' });
        return;
    }

    fetchLoading.value = true;
    fetchError.value = null;
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}`);
        const task = response.data;
        editTaskData.value = {
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
        };

        // Load existing attachments if available
        if (task.attachments && Array.isArray(task.attachments)) {
            existingAttachments.value = task.attachments;
        }

        // Load task threads
        await loadTaskThreads(Array.isArray(taskId) ? taskId[0] : taskId);
    } catch (e: any) {
        fetchError.value = e.response?.data?.error || e.message || 'Unknown error';
    } finally {
        fetchLoading.value = false;
    }
}

// Function to scroll to the bottom of the messages container
function scrollToBottom() {
    setTimeout(() => {
        if (messagesContainerRef.value) {
            messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
        }
    }, 0);
}

// Load task threads from the server
async function loadTaskThreads(taskId: string) {
    threadLoading.value = true;
    threadError.value = null;
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}/threads`);

        // We only care about external threads in the SDK
        if (response.data.external && Array.isArray(response.data.external)) {
            externalMessages.value = response.data.external.map((thread: any) => ({
                id: thread.id,
                sender: thread.sender_name,
                content: thread.content,
                timestamp: new Date(thread.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isCurrentUser: thread.is_current_user,
                attachments: thread.attachments || [],
            }));

            // Scroll to bottom after messages are loaded
            scrollToBottom();
        }
    } catch (e: any) {
        threadError.value = e.response?.data?.error || e.message || 'Error loading threads';
        console.error('Error loading task threads:', e);
    } finally {
        threadLoading.value = false;
    }
}

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

function deleteAttachment(attachmentId: number) {
    deletedAttachmentIds.value.push(attachmentId);
    existingAttachments.value = existingAttachments.value.filter((attachment) => attachment.id !== attachmentId);
}

// Handle thread file upload
function handleThreadFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
            uploadThreadFile(input.files[i]);
        }
    }

    // Clear the file input
    input.value = '';
}

// Upload a thread file
async function uploadThreadFile(file: File) {
    isThreadUploading.value = true;
    threadUploadError.value = null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('temp_identifier', threadTempIdentifier.value);

    try {
        const response = await axios.post('/shift/api/attachments/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        threadAttachments.value.push(response.data);
        isThreadUploading.value = false;
    } catch (e: any) {
        isThreadUploading.value = false;
        threadUploadError.value = e.response?.data?.message || 'Error uploading file';
        console.error('Thread upload error:', e);
    }
}

// Remove a thread attachment
async function removeThreadAttachment(file: any) {
    try {
        await axios.delete('/shift/api/attachments/remove-temp', {
            params: { path: file.path },
        });

        // Remove from the list
        threadAttachments.value = threadAttachments.value.filter((f) => f.path !== file.path);
    } catch (e: any) {
        console.error('Error removing thread attachment:', e);
    }
}

// Function to send a new message
async function sendMessage(event?: Event) {
    // Prevent form submission
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // Get content from the message editor
    const editorContent = messageEditorRef.value?.getMarkdown() || '';

    if (!editorContent.trim() && threadAttachments.value.length === 0) return;

    const taskId = route.params.id;
    if (!taskId) return;

    try {
        const response = await axios.post(`/shift/api/tasks/${taskId}/threads`, {
            content: editorContent,
            type: 'external', // Always external for SDK
            temp_identifier: threadAttachments.value.length > 0 ? threadTempIdentifier.value : null,
        });

        const message = {
            id: response.data.thread.id,
            sender: response.data.thread.sender_name,
            content: response.data.thread.content,
            timestamp: new Date(response.data.thread.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            }),
            isCurrentUser: response.data.thread.is_current_user,
            attachments: response.data.thread.attachments || [],
        };

        externalMessages.value.push(message);

        // Clear editor
        if (messageEditorRef.value) {
            messageEditorRef.value.setMarkdown('');
        }

        threadAttachments.value = [];
        threadTempIdentifier.value = Date.now().toString() + '_thread';

        // Scroll to bottom to show the new message
        scrollToBottom();
    } catch (e: any) {
        console.error('Error sending message:', e);
        threadError.value = e.response?.data?.error || e.message || 'Failed to send message';
    }
}

async function updateTask() {
    const taskId = route.params.id;
    if (!taskId) {
        router.push({ name: 'task-list' });
        return;
    }

    editError.value = null;
    loading.value = true;
    try {
        // Get the current URL for the source_url
        const source_url = window.location.origin;

        // Get the environment from the config or default to 'production'
        const environment = import.meta.env.VITE_APP_ENV || 'production';

        // Get description content from the editor
        const descriptionContent = descriptionEditorRef.value?.getMarkdown() || editTaskData.value.description;

        // Create the payload with task data
        const payload = {
            title: editTaskData.value.title,
            description: descriptionContent,
            status: editTaskData.value.status,
            priority: editTaskData.value.priority,
            source_url,
            environment,
            deleted_attachment_ids: deletedAttachmentIds.value.length > 0 ? deletedAttachmentIds.value : undefined,
            temp_identifier: uploadedFiles.value.length > 0 ? tempIdentifier.value : undefined,
        };

        await axios.put(`/shift/api/tasks/${taskId}`, payload);
        router.push({ name: 'task-list' });
    } catch (e: any) {
        editError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

function cancel() {
    router.push({ name: 'task-list' });
}

// Initialize the editors when component is mounted
onMounted(() => {
    fetchTask();

    // Initialize Toast Editors after DOM is ready
    setTimeout(() => {
        // Initialize message editor
        if (messageEditorContainerRef.value) {
            messageEditorRef.value = new Editor({
                el: messageEditorContainerRef.value,
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
            const editorEl = messageEditorContainerRef.value.querySelector('.toastui-editor-main .ProseMirror');
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

    // Initialize description editor with a longer delay to ensure DOM is ready
    let retryCount = 0;
    const maxRetries = 5;

    const initDescriptionEditor = () => {
        // Check if we should attempt initialization (not loading and no fetch error)
        const shouldInitialize = !fetchLoading.value && !fetchError.value;

        if (shouldInitialize && descriptionEditorContainerRef.value) {
            console.log('Initializing description editor');
            try {
                // Check if the editor is already initialized
                if (descriptionEditorRef.value) {
                    console.log('Description editor already initialized');
                    return;
                }

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

                // Set initial content if available
                if (editTaskData.value.description) {
                    descriptionEditorRef.value.setMarkdown(editTaskData.value.description);
                }

                console.log('Description editor initialized successfully');
            } catch (error) {
                console.error('Error initializing description editor:', error);
            }
        } else {
            const reason = fetchLoading.value ? 'form is still loading' : fetchError.value ? 'fetch error occurred' : 'container not found';

            console.error(`Description editor initialization skipped: ${reason} (attempt ${retryCount + 1}/${maxRetries})`);

            // Retry after a delay if we haven't exceeded max retries
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(initDescriptionEditor, 200);
            }
        }
    };

    // Start initialization with a longer delay
    setTimeout(initDescriptionEditor, 300);

    // Also watch for when fetchLoading changes to false (data loaded)
    watch(fetchLoading, (newValue) => {
        if (newValue === false && !descriptionEditorRef.value) {
            console.log('Data loaded, attempting to initialize description editor');
            // Reset retry count for this new attempt
            retryCount = 0;
            // Small delay to ensure DOM is updated
            setTimeout(initDescriptionEditor, 100);
        }
    });
});

// Clean up the editors when component is unmounted
onBeforeUnmount(() => {
    if (messageEditorRef.value) {
        messageEditorRef.value.destroy();
        messageEditorRef.value = null;
    }

    if (descriptionEditorRef.value) {
        descriptionEditorRef.value.destroy();
        descriptionEditorRef.value = null;
    }
});
</script>

<style>
/* Basic styling for markdown content */
.markdown-content {
    line-height: 1.5;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: bold;
}

.markdown-content h1 {
    font-size: 1.5em;
}

.markdown-content h2 {
    font-size: 1.3em;
}

.markdown-content h3 {
    font-size: 1.2em;
}

.markdown-content p {
    margin-bottom: 1em;
}

.markdown-content ul,
.markdown-content ol {
    margin-left: 1.5em;
    margin-bottom: 1em;
}

.markdown-content code {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
}

.markdown-content pre {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 1em;
    border-radius: 3px;
    overflow-x: auto;
    margin-bottom: 1em;
}

.markdown-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 1em;
    color: #666;
    margin-bottom: 1em;
}

.markdown-content a {
    color: #0366d6;
    text-decoration: underline;
}

.markdown-content table {
    border-collapse: collapse;
    margin-bottom: 1em;
    width: 100%;
}

.markdown-content table th,
.markdown-content table td {
    border: 1px solid #ddd;
    padding: 0.5em;
}

.markdown-content table th {
    background-color: rgba(0, 0, 0, 0.05);
}
</style>

<template>
    <Card class="w-full flex-1 flex flex-col overflow-hidden">
        <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>Edit Task</CardTitle>
            <Button
                variant="outline"
                size="sm"
                @click="cancel"
                title="Cancel"
            >
                <X class="h-4 w-4" />
            </Button>
        </CardHeader>

        <CardContent class="flex flex-1 justify-center gap-6 overflow-hidden ">
            <FormItem class="flex flex-col h-full flex-1">
                    <div v-if="fetchLoading" class="space-y-4 py-8">
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-40 w-full" />
                        <div class="flex gap-4">
                            <Skeleton class="h-10 w-1/2" />
                            <Skeleton class="h-10 w-1/2" />
                        </div>
                    </div>
                    <div v-else-if="fetchError" class="py-8 text-center text-red-600">{{ fetchError }}</div>
                    <form v-else class="flex flex-1 flex-col gap-3 " @submit.prevent="updateTask">
                        <FormItem class="flex-1 space-y-3 ">
                            <FormItem>
                                <Label>Title</Label>
                                <Input v-model="editTaskData.title" required />
                            </FormItem>
                            <FormItem>
                                <Label>Description</Label>
                                <div ref="descriptionEditorContainerRef" class="w-full rounded border" style="min-height: 250px"></div>
                            </FormItem>
                            <div class="flex gap-4">
                                <FormItem class="flex-1">
                                    <Label>Status</Label>
                                    <Select v-model="editTaskData.status">
                                        <option value="pending">Pending</option>
                                        <option disabled value="in-progress">In progress</option>
                                        <option value="awaiting-feedback">Awaiting feedback</option>
                                        <option value="completed">Completed</option>
                                        <option value="closed">Closed</option>
                                    </Select>
                                </FormItem>
                                <FormItem class="flex-1">
                                    <Label>Priority</Label>
                                    <Select v-model="editTaskData.priority">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </Select>
                                </FormItem>
                            </div>

                            <!-- Existing Attachments -->
                            <FormItem v-if="existingAttachments.length > 0" class="mt-4">
                                <Label>Existing Attachments</Label>
                                <div class="rounded border bg-card p-2">
                                    <div v-for="attachment in existingAttachments" :key="attachment.id" class="flex items-center justify-between py-1">
                                        <div class="flex items-center">
                                            <svg class="mr-2 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    clip-rule="evenodd"
                                                    d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                                                    fill-rule="evenodd"
                                                />
                                            </svg>
                                            <a :href="attachment.url" class="text-sm text-primary hover:underline" target="_blank">
                                                {{ attachment.original_filename }}
                                            </a>
                                        </div>
                                        <Button variant="destructive" size="sm" type="button" @click="deleteAttachment(attachment.id)" title="Remove">
                                            <Trash2 class="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </FormItem>

                            <!-- New Attachments -->
                            <FormItem class="mt-4">
                                <Label>Add New Attachments</Label>
                                <input :disabled="isUploading" class="w-full rounded border px-2 py-1" multiple type="file" @change="handleFileChange" />

                                <!-- Upload error message -->
                                <div v-if="uploadError" class="mt-1 text-sm text-red-500">{{ uploadError }}</div>

                                <!-- Loading indicator -->
                                <div v-if="isUploading" class="mt-2">
                                    <Skeleton class="h-6 w-3/4" />
                                    <Skeleton class="mt-1 h-6 w-1/2" />
                                </div>

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
                            <div v-if="editError" class="text-sm text-red-600">{{ editError }}</div>
                        </FormItem>
                        <div>
                            <Button :disabled="loading" variant="primary" class="mt-2" type="submit" title="Save">
                                <Save class="h-4 w-4 mr-1" />
                                {{ loading ? 'Saving...' : 'Save' }}
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
                        </div>
                    </form>
            </FormItem>

            <!-- Thread Section (outside the form) -->
            <div class="flex w-[600px] flex-col  h-full overflow-hidden">
                <!-- External Thread Section -->
                <h3 class="mb-2 text-sm font-medium">Comments</h3>
                <!-- Thread loading indicator -->
                <div v-if="threadLoading" class="space-y-3 py-4">
                    <div class="flex items-start gap-2">
                        <Skeleton variant="circle" class="h-8 w-8" />
                        <div class="w-3/4 space-y-2">
                            <Skeleton class="h-4 w-1/4" />
                            <Skeleton class="h-20 w-full" />
                        </div>
                    </div>
                    <div class="flex items-start justify-end gap-2">
                        <div class="w-3/4 space-y-2">
                            <Skeleton class="h-4 w-1/4 ml-auto" />
                            <Skeleton class="h-16 w-full" />
                        </div>
                        <Skeleton variant="circle" class="h-8 w-8" />
                    </div>
                </div>
                <div v-else-if="threadError" class="py-4 text-center text-red-600">{{ threadError }}</div>

                <div v-else ref="messagesContainerRef" class="flex-1 overflow-auto">
                    <!-- Messages container with fixed height and scrolling -->
                    <div class="mb-4 rounded bg-gray-50 px-2">
                        <div v-if="externalMessages.length === 0" class="py-4 text-center text-gray-500">
                            No messages yet. Start the conversation!
                        </div>

                        <div
                            v-for="message in externalMessages"
                            :key="message.id"
                            :class="message.isCurrentUser ? 'text-right' : 'text-left'"
                            class="mb-3"
                        >
                            <p>
                                <span v-if="!message.isCurrentUser" class="text-xs">{{ message.sender }} -</span>

                                <span class="mt-1 text-xs opacity-75">{{ message.timestamp }}</span>
                            </p>
                            <div
                                :class="
                                    message.isCurrentUser
                                        ? 'rounded-br-none bg-primary font-bold text-primary-foreground'
                                        : 'rounded-bl-none bg-muted text-muted-foreground'
                                "
                                class="inline-block max-w-3/4 min-w-1/3 rounded-lg p-3"
                            >
                                <div class="markdown-content" v-html="renderMarkdown(message.content)"></div>

                                <!-- Display message attachments if any -->
                                <div v-if="message.attachments && message.attachments.length > 0" class="mt-2">
                                    <p class="text-xs font-semibold">Attachments:</p>
                                    <div v-for="attachment in message.attachments" :key="attachment.id" class="mt-1">
                                        <a :href="attachment.url" class="flex items-center text-xs underline" target="_blank">
                                            <svg class="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    clip-rule="evenodd"
                                                    d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                                                    fill-rule="evenodd"
                                                />
                                            </svg>
                                            {{ attachment.original_filename }}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Thread attachments display -->
                    <div v-if="threadAttachments.length > 0" class="mb-3">
                        <h4 class="text-sm font-medium text-gray-700">Attachments:</h4>
                        <ul class="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200">
                            <li v-for="file in threadAttachments" :key="file.path" class="flex items-center justify-between px-3 py-2 text-sm">
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
                                <Button variant="destructive" size="sm" type="button" @click="removeThreadAttachment(file)" title="Remove">
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            </li>
                        </ul>
                    </div>

                    <!-- Thread upload error message -->
                    <div v-if="threadUploadError" class="mb-2 text-sm text-red-500">{{ threadUploadError }}</div>

                    <!-- Thread loading indicator -->
                    <div v-if="isThreadUploading" class="mb-2 space-y-1">
                        <Skeleton class="h-5 w-2/3" />
                        <Skeleton class="h-5 w-1/2" />
                    </div>
                </div>

                <!-- Message input with Toast Editor and attachment button -->
                <div class="flex flex-col">
                    <div class="mb-2 flex flex-col">
                        <!-- Toast Editor Container -->
                        <div ref="messageEditorContainerRef" class="mb-2 rounded-md border"></div>

                        <div class="flex">
                            <label
                                class="flex cursor-pointer items-center rounded-l-md bg-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                    />
                                </svg>
                                <input class="hidden" multiple type="file" @change="handleThreadFileUpload" />
                            </label>
                            <Button
                                variant="primary"
                                class="flex-grow rounded-r-md"
                                type="button"
                                @click.prevent="sendMessage($event)"
                                title="Send"
                            >
                                <Send class="h-4 w-4 mr-1" />
                                Send
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
