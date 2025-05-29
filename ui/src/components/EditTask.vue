<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../axios-config'

const router = useRouter()
const route = useRoute()
const editError = ref<string|null>(null)
const loading = ref(false)
const fetchLoading = ref(true)
const fetchError = ref<string|null>(null)
const isUploading = ref(false)
const uploadError = ref<string|null>(null)
const uploadedFiles = ref<any[]>([])
const tempIdentifier = ref(Date.now().toString())
const existingAttachments = ref<any[]>([])
const deletedAttachmentIds = ref<number[]>([])

// Thread state
const externalMessages = ref<any[]>([])
const newMessage = ref('')
const threadLoading = ref(false)
const threadError = ref<string|null>(null)

// Thread attachment state
const threadTempIdentifier = ref(Date.now().toString() + '_thread')
const threadAttachments = ref<any[]>([])
const isThreadUploading = ref(false)
const threadUploadError = ref<string|null>(null)

const editTaskData = ref({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
})

async function fetchTask() {
    const taskId = route.params.id
    if (!taskId) {
        router.push({ name: 'task-list' })
        return
    }

    fetchLoading.value = true
    fetchError.value = null
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}`)
        const task = response.data
        editTaskData.value = {
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
        }

        // Load existing attachments if available
        if (task.attachments && Array.isArray(task.attachments)) {
            existingAttachments.value = task.attachments
        }

        // Load task threads
        await loadTaskThreads(taskId)
    } catch (e: any) {
        fetchError.value = e.response?.data?.error || e.message || 'Unknown error'
    } finally {
        fetchLoading.value = false
    }
}

// Load task threads from the server
async function loadTaskThreads(taskId: string) {
    threadLoading.value = true
    threadError.value = null
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}/threads`)

        // We only care about external threads in the SDK
        if (response.data.external && Array.isArray(response.data.external)) {
            externalMessages.value = response.data.external.map((thread: any) => ({
                id: thread.id,
                sender: thread.sender_name,
                content: thread.content,
                timestamp: new Date(thread.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isCurrentUser: thread.is_current_user,
                attachments: thread.attachments || []
            }));
        }
    } catch (e: any) {
        threadError.value = e.response?.data?.error || e.message || 'Error loading threads'
        console.error('Error loading task threads:', e)
    } finally {
        threadLoading.value = false
    }
}

async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    isUploading.value = true
    uploadError.value = null

    try {
        const formData = new FormData()
        formData.append('temp_identifier', tempIdentifier.value)

        // Add all files to the formData
        Array.from(input.files).forEach((file, index) => {
            formData.append(`attachments[${index}]`, file)
        })

        // Upload files immediately
        const response = await axios.post('/shift/api/attachments/upload-multiple', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })

        // Add the uploaded files to our list
        if (response.data.files && Array.isArray(response.data.files)) {
            uploadedFiles.value = [...uploadedFiles.value, ...response.data.files]
        }
    } catch (error: any) {
        uploadError.value = error.response?.data?.message || 'Error uploading files'
        console.error('Upload error:', error)
    } finally {
        isUploading.value = false
        // Clear the file input
        input.value = ''
    }
}

// Remove a temporary file
async function removeFile(file: any) {
    try {
        await axios.delete('/shift/api/attachments/remove-temp', {
            params: { path: file.path }
        })

        // Remove from the list
        uploadedFiles.value = uploadedFiles.value.filter(f => f.path !== file.path)
    } catch (error) {
        console.error('Error removing file:', error)
    }
}

function deleteAttachment(attachmentId: number) {
    deletedAttachmentIds.value.push(attachmentId)
    existingAttachments.value = existingAttachments.value.filter(
        attachment => attachment.id !== attachmentId
    )
}

// Handle thread file upload
function handleThreadFileUpload(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
            uploadThreadFile(input.files[i])
        }
    }

    // Clear the file input
    input.value = ''
}

// Upload a thread file
async function uploadThreadFile(file: File) {
    isThreadUploading.value = true
    threadUploadError.value = null

    const formData = new FormData()
    formData.append('file', file)
    formData.append('temp_identifier', threadTempIdentifier.value)

    try {
        const response = await axios.post('/shift/api/attachments/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })

        threadAttachments.value.push(response.data)
        isThreadUploading.value = false
    } catch (e: any) {
        isThreadUploading.value = false
        threadUploadError.value = e.response?.data?.message || 'Error uploading file'
        console.error('Thread upload error:', e)
    }
}

// Remove a thread attachment
async function removeThreadAttachment(file: any) {
    try {
        await axios.delete('/shift/api/attachments/remove-temp', {
            params: { path: file.path }
        })

        // Remove from the list
        threadAttachments.value = threadAttachments.value.filter(f => f.path !== file.path)
    } catch (e: any) {
        console.error('Error removing thread attachment:', e)
    }
}

// Function to send a new message
async function sendMessage(event?: Event) {
    // Prevent form submission
    if (event) {
        event.preventDefault()
        event.stopPropagation()
    }

    if (!newMessage.value.trim() && threadAttachments.value.length === 0) return

    const taskId = route.params.id
    if (!taskId) return

    try {
        const response = await axios.post(`/shift/api/tasks/${taskId}/threads`, {
            content: newMessage.value,
            type: 'external', // Always external for SDK
            temp_identifier: threadAttachments.value.length > 0 ? threadTempIdentifier.value : null
        })

        const message = {
            id: response.data.thread.id,
            sender: response.data.thread.sender_name,
            content: response.data.thread.content,
            timestamp: new Date(response.data.thread.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isCurrentUser: response.data.thread.is_current_user,
            attachments: response.data.thread.attachments || []
        }

        externalMessages.value.push(message)

        // Clear form
        newMessage.value = ''
        threadAttachments.value = []
        threadTempIdentifier.value = Date.now().toString() + '_thread'
    } catch (e: any) {
        console.error('Error sending message:', e)
        threadError.value = e.response?.data?.error || e.message || 'Failed to send message'
    }
}

async function updateTask() {
    const taskId = route.params.id
    if (!taskId) {
        router.push({ name: 'task-list' })
        return
    }

    editError.value = null
    loading.value = true
    try {
        // Get the current URL for the source_url
        const source_url = window.location.origin

        // Get the environment from the config or default to 'production'
        const environment = import.meta.env.VITE_APP_ENV || 'production'

        // Create the payload with task data
        const payload = {
            title: editTaskData.value.title,
            description: editTaskData.value.description,
            status: editTaskData.value.status,
            priority: editTaskData.value.priority,
            source_url,
            environment,
            deleted_attachment_ids: deletedAttachmentIds.value.length > 0 ? deletedAttachmentIds.value : undefined,
            temp_identifier: uploadedFiles.value.length > 0 ? tempIdentifier.value : undefined
        }

        await axios.put(`/shift/api/tasks/${taskId}`, payload)
        router.push({ name: 'task-list' })
    } catch (e: any) {
        editError.value =
            e.response?.data?.error ||
            e.response?.data?.message ||
            e.message ||
            'Unknown error'
    } finally {
        loading.value = false
    }
}

function cancel() {
    router.push({ name: 'task-list' })
}

onMounted(fetchTask)
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">Edit Task</h1>
            <button
                @click="cancel"
                class="px-4 py-2 rounded text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition"
            >
                Cancel
            </button>
        </div>

        <div v-if="fetchLoading" class="text-gray-500 text-center py-8">Loading task data...</div>
        <div v-else-if="fetchError" class="text-red-600 text-center py-8">{{ fetchError }}</div>
        <form v-else @submit.prevent="updateTask" class="space-y-3">
            <div>
                <label class="block text-sm font-medium mb-1">Title</label>
                <input v-model="editTaskData.title" required type="text" class="w-full border rounded px-2 py-1" />
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Description</label>
                <textarea
                    v-model="editTaskData.description"
                    rows="4"
                    class="w-full border rounded px-2 py-1"
                ></textarea>
            </div>
            <div class="flex gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Status</label>
                    <select v-model="editTaskData.status" class="border rounded px-2 py-1">
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Priority</label>
                    <select v-model="editTaskData.priority" class="border rounded px-2 py-1">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>

            <!-- Existing Attachments -->
            <div v-if="existingAttachments.length > 0" class="mt-4">
                <label class="block text-sm font-medium mb-1">Existing Attachments</label>
                <div class="border rounded p-2 bg-gray-50">
                    <div v-for="attachment in existingAttachments" :key="attachment.id" class="flex justify-between items-center py-1">
                        <div class="flex items-center">
                            <svg class="h-4 w-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                            </svg>
                            <a :href="attachment.url" target="_blank" class="text-sm text-blue-600 hover:underline">
                                {{ attachment.original_filename }}
                            </a>
                        </div>
                        <button
                            type="button"
                            @click="deleteAttachment(attachment.id)"
                            class="text-xs text-red-600 hover:text-red-800"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            </div>

            <!-- New Attachments -->
            <div class="mt-4">
                <label class="block text-sm font-medium mb-1">Add New Attachments</label>
                <input
                    type="file"
                    @change="handleFileChange"
                    multiple
                    class="w-full border rounded px-2 py-1"
                    :disabled="isUploading"
                />

                <!-- Upload error message -->
                <div v-if="uploadError" class="text-red-500 text-sm mt-1">{{ uploadError }}</div>

                <!-- Loading indicator -->
                <div v-if="isUploading" class="text-blue-500 text-sm mt-1">Uploading files...</div>

                <!-- List of uploaded files -->
                <div v-if="uploadedFiles.length > 0" class="mt-3">
                    <p class="text-sm text-gray-600">Uploaded files:</p>
                    <ul class="mt-2 divide-y divide-gray-200 border border-gray-200 rounded-md">
                        <li v-for="file in uploadedFiles" :key="file.path" class="flex items-center justify-between py-2 px-3 text-sm">
                            <div class="flex items-center">
                                <svg class="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                                </svg>
                                <span class="truncate">{{ file.original_filename }}</span>
                            </div>
                            <button
                                type="button"
                                @click="removeFile(file)"
                                class="text-red-600 hover:text-red-900"
                                :disabled="loading"
                            >
                                Remove
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
            <div v-if="editError" class="text-red-600 text-sm">{{ editError }}</div>
            <div>
                <button
                    type="submit"
                    class="mt-2 px-4 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700"
                    :disabled="loading"
                >
                    {{ loading ? 'Saving...' : 'Save' }}
                </button>
                <button
                    type="button"
                    @click="cancel"
                    class="ml-2 px-4 py-1 rounded bg-gray-200 text-gray-600 font-bold hover:bg-gray-300"
                    :disabled="loading"
                >
                    Cancel
                </button>
            </div>
            <!-- External Thread Section -->
            <div class="mt-8">
                <h3 class="text-lg font-medium mb-4">Thread</h3>
            </div>
        </form>

        <!-- Thread Section (outside the form) -->
        <div class="max-w-xl mx-auto mt-4 p-6 bg-white rounded-2xl">
            <!-- Thread loading indicator -->
            <div v-if="threadLoading" class="text-gray-500 text-center py-4">Loading thread messages...</div>
            <div v-else-if="threadError" class="text-red-600 text-center py-4">{{ threadError }}</div>

            <div v-else>
                <!-- Messages container with fixed height and scrolling -->
                <div class="h-64 overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
                    <div v-if="externalMessages.length === 0" class="text-gray-500 text-center py-4">
                        No messages yet. Start the conversation!
                    </div>

                    <div v-for="message in externalMessages" :key="message.id"
                        class="mb-3"
                        :class="message.isCurrentUser ? 'text-right' : 'text-left'">
                        <div class="inline-block max-w-3/4 p-3 rounded-lg"
                            :class="message.isCurrentUser ? 'bg-amber-600 text-white font-bold rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'">
                            <p v-if="!message.isCurrentUser" class="text-sm font-semibold">{{ message.sender }}</p>
                            <p>{{ message.content }}</p>

                            <!-- Display message attachments if any -->
                            <div v-if="message.attachments && message.attachments.length > 0" class="mt-2">
                                <p class="text-xs font-semibold">Attachments:</p>
                                <div v-for="attachment in message.attachments" :key="attachment.id" class="mt-1">
                                    <a :href="attachment.url" target="_blank" class="text-xs underline flex items-center">
                                        <svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                                        </svg>
                                        {{ attachment.original_filename }}
                                    </a>
                                </div>
                            </div>

                            <p class="text-xs mt-1 opacity-75">{{ message.timestamp }}</p>
                        </div>
                    </div>
                </div>

                <!-- Thread attachments display -->
                <div v-if="threadAttachments.length > 0" class="mb-3">
                    <h4 class="text-sm font-medium text-gray-700">Attachments:</h4>
                    <ul class="mt-2 divide-y divide-gray-200 border border-gray-200 rounded-md">
                        <li v-for="file in threadAttachments" :key="file.path" class="flex items-center justify-between py-2 px-3 text-sm">
                            <div class="flex items-center">
                                <svg class="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                                </svg>
                                <span class="truncate">{{ file.original_filename }}</span>
                            </div>
                            <button
                                type="button"
                                @click="removeThreadAttachment(file)"
                                class="text-red-600 hover:text-red-900"
                            >
                                Remove
                            </button>
                        </li>
                    </ul>
                </div>

                <!-- Thread upload error message -->
                <div v-if="threadUploadError" class="text-red-500 text-sm mb-2">{{ threadUploadError }}</div>

                <!-- Thread loading indicator -->
                <div v-if="isThreadUploading" class="text-blue-500 text-sm mb-2">Uploading attachment...</div>

                <!-- Message input with attachment button -->
                <div class="flex flex-col">
                    <div class="flex mb-2">
                        <input
                            v-model="newMessage"
                            type="text"
                            placeholder="Type your message..."
                            class="flex-grow border rounded-l-md p-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            @keyup.enter.prevent="sendMessage($event)"
                        />
                        <label class="cursor-pointer bg-gray-200 text-gray-700 px-3 py-2 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <input
                                type="file"
                                class="hidden"
                                multiple
                                @change="handleThreadFileUpload"
                            />
                        </label>
                        <button
                            type="button"
                            @click.prevent="sendMessage($event)"
                            class="bg-amber-600 text-white px-4 py-2 rounded-r-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
