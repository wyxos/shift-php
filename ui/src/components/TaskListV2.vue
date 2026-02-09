<script setup lang="ts">
/* eslint-disable max-lines */
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import axios from '@/axios-config'
import { Filter, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@shift/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@shift/ui/card'
import { Input } from '@shift/ui/input'
import { Label } from '@shift/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@shift/ui/sheet'
import Badge from './ui/badge.vue'
import Select from './ui/select.vue'
import ShiftEditor from '@shared/components/ShiftEditor.vue'
import ImageLightbox from './ui/ImageLightbox.vue'
import { toast } from 'vue-sonner'

type Task = {
  id: number
  title: string
  status: string
  priority: string
}

type TaskAttachment = {
  id: number
  original_filename: string
  url?: string
  path?: string
}

type TaskDetail = Task & {
  description?: string
  submitter?: { name?: string; email?: string }
  attachments?: TaskAttachment[]
}

type ThreadMessage = {
  id: number
  author: string
  time: string
  content: string
  isYou?: boolean
}

const tasks = ref<Task[]>([])
const totalTasks = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const deleteLoading = ref<number | null>(null)
const filtersOpen = ref(false)
const highlightedTaskId = ref<number | null>(null)
let highlightTimer: number | null = null

const createOpen = ref(false)
const createLoading = ref(false)
const createError = ref<string | null>(null)
const createUploading = ref(false)
const createTempIdentifier = ref(Date.now().toString())
const createForm = ref({
  title: '',
  priority: 'medium',
  description: '',
})

const editOpen = ref(false)
const editLoading = ref(false)
const editError = ref<string | null>(null)
const editUploading = ref(false)
const editTempIdentifier = ref(Date.now().toString())
const editTask = ref<TaskDetail | null>(null)
const editForm = ref({
  title: '',
  priority: 'medium',
  description: '',
})

const threadTempIdentifier = ref(Date.now().toString())
const threadMessages = ref<ThreadMessage[]>([
  {
    id: 1,
    author: 'Riley Sutton',
    time: '2 days ago',
    content: '<p>We should align the labels on the status chips so they feel consistent.</p>',
  },
  {
    id: 2,
    author: 'You',
    time: '1 day ago',
    content: '<p>Noted. I can also reuse the new editor styling so attachments feel cohesive.</p>',
    isYou: true,
  },
  {
    id: 3,
    author: 'Riley Sutton',
    time: 'Today',
    content: '<p>Perfect. Let me know when a preview is ready and I will sanity check.</p>',
  },
])

const commentsScrollRef = ref<HTMLElement | null>(null)

const lightboxOpen = ref(false)
const lightboxSrc = ref('')
const lightboxAlt = ref('')

function openLightboxForImage(img: HTMLImageElement) {
  const src = img.currentSrc || img.src
  if (!src) return
  lightboxSrc.value = src
  lightboxAlt.value = img.alt || img.title || 'Image'
  lightboxOpen.value = true
}

function onRichContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  const img = target.closest('img') as HTMLImageElement | null
  if (!img) return
  // Only intercept images inside rich html blocks (editor tiles, rendered descriptions, thread content).
  const inRich = Boolean(img.closest('.shift-rich')) || Boolean(img.closest('.tiptap')) || img.classList.contains('editor-tile')
  if (!inRich) return
  event.preventDefault()
  event.stopPropagation()
  openLightboxForImage(img)
}

function shouldHandleImage(img: HTMLImageElement) {
  const inRich = Boolean(img.closest('.shift-rich')) || Boolean(img.closest('.tiptap')) || img.classList.contains('editor-tile')
  if (!inRich) return { ok: false, inEditable: false }
  const inEditable = Boolean(img.closest('[contenteditable="true"]'))
  return { ok: true, inEditable }
}

function onGlobalClickCapture(event: MouseEvent) {
  if (!editOpen.value) return
  const target = event.target as HTMLElement | null
  if (!target) return
  const img = target.closest('img') as HTMLImageElement | null
  if (!img) return
  const { ok, inEditable } = shouldHandleImage(img)
  if (!ok || inEditable) return
  event.preventDefault()
  event.stopPropagation()
  openLightboxForImage(img)
}

function onGlobalDblClickCapture(event: MouseEvent) {
  if (!editOpen.value) return
  const target = event.target as HTMLElement | null
  if (!target) return
  const img = target.closest('img') as HTMLImageElement | null
  if (!img) return
  const { ok, inEditable } = shouldHandleImage(img)
  if (!ok || !inEditable) return
  event.preventDefault()
  event.stopPropagation()
  openLightboxForImage(img)
}

function scrollCommentsToBottom() {
  const el = commentsScrollRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

watch(editOpen, async (open) => {
  if (!open) return
  await nextTick()
  scrollCommentsToBottom()
})

watch(
  () => threadMessages.value.length,
  async () => {
    if (!editOpen.value) return
    await nextTick()
    scrollCommentsToBottom()
  },
)

function highlightTask(taskId: number) {
  highlightedTaskId.value = taskId
  if (highlightTimer) window.clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(() => {
    highlightedTaskId.value = null
    highlightTimer = null
  }, 4500)
}

onMounted(() => {
  // Capture phase so we can open the preview even if the editor stops propagation.
  document.addEventListener('click', onGlobalClickCapture, true)
  document.addEventListener('dblclick', onGlobalDblClickCapture, true)
})

onBeforeUnmount(() => {
  if (highlightTimer) window.clearTimeout(highlightTimer)
  document.removeEventListener('click', onGlobalClickCapture, true)
  document.removeEventListener('dblclick', onGlobalDblClickCapture, true)
})

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'awaiting-feedback', label: 'Awaiting Feedback' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const uploadEndpoints = {
  init: '/shift/api/attachments/upload-init',
  status: '/shift/api/attachments/upload-status',
  chunk: '/shift/api/attachments/upload-chunk',
  complete: '/shift/api/attachments/upload-complete',
}

const removeTempUrl = '/shift/api/attachments/remove-temp'

function resolveTempUrl(data: any): string {
  if (data && data.url) return data.url as string
  if (data && data.path) {
    const match = String(data.path).match(/^temp_attachments\/([^/]+)\/(.+)$/)
    if (match) {
      return `/shift/api/attachments/temp/${match[1]}/${match[2]}`
    }
  }
  return ''
}

const defaultStatuses = statusOptions
  .filter((option) => !['completed', 'closed'].includes(option.value))
  .map((option) => option.value)

const selectedStatuses = ref<string[]>([...defaultStatuses])
const selectedPriorities = ref<string[]>(priorityOptions.map((option) => option.value))
const searchTerm = ref('')

const activeFilterCount = computed(() => {
  let count = 0
  if (selectedStatuses.value.length && selectedStatuses.value.length < statusOptions.length) count += 1
  if (selectedPriorities.value.length && selectedPriorities.value.length < priorityOptions.length) count += 1
  if (searchTerm.value.trim()) count += 1
  return count
})

const isOwner = computed(() => {
  const currentEmail = window.shiftConfig?.email
  const submitterEmail = editTask.value?.submitter?.email
  if (!currentEmail || !submitterEmail) return false
  return currentEmail === submitterEmail
})

const nonImageAttachments = computed(() => {
  if (!editTask.value?.attachments) return []
  return editTask.value.attachments.filter((attachment) => !isImageFilename(attachment.original_filename))
})

function isImageFilename(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)
}

function resetCreateForm() {
  createForm.value = {
    title: '',
    priority: 'medium',
    description: '',
  }
  createTempIdentifier.value = Date.now().toString()
  createError.value = null
  createUploading.value = false
}

function openCreate() {
  resetCreateForm()
  createOpen.value = true
}

function closeCreate() {
  createOpen.value = false
}

async function createTask() {
  createError.value = null
  createLoading.value = true

  try {
    const source_url = window.location.origin
    const environment = import.meta.env.VITE_APP_ENV || 'production'

    const payload = {
      title: createForm.value.title,
      description: createForm.value.description,
      priority: createForm.value.priority,
      source_url,
      environment,
      temp_identifier: createTempIdentifier.value,
    }

    const response = await axios.post('/shift/api/tasks', payload)
    const created = response.data?.data ?? response.data
    const createdId = typeof created?.id === 'number' ? (created.id as number) : null
    closeCreate()
    await fetchTasks()
    if (createdId) highlightTask(createdId)
    toast.success('Task created', { description: 'Your task has been added to the queue.' })
  } catch (e: any) {
    createError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error'
  } finally {
    createLoading.value = false
  }
}

async function openEdit(taskId: number) {
  editOpen.value = true
  editLoading.value = true
  editError.value = null
  editTask.value = null
  editUploading.value = false

  try {
    const response = await axios.get(`/shift/api/tasks/${taskId}`)
    const data = response.data?.data ?? response.data
    editTask.value = data
    editForm.value = {
      title: data?.title ?? '',
      priority: data?.priority ?? 'medium',
      description: data?.description ?? '',
    }
    editTempIdentifier.value = Date.now().toString()
  } catch (e: any) {
    editError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to fetch task'
  } finally {
    editLoading.value = false
  }
}

function closeEdit() {
  editOpen.value = false
  editTask.value = null
  editError.value = null
  editUploading.value = false
}

async function saveEdit() {
  if (!editTask.value || !isOwner.value) return

  editError.value = null
  editLoading.value = true

  try {
    const payload = {
      title: editForm.value.title,
      description: editForm.value.description,
      priority: editForm.value.priority,
      temp_identifier: editTempIdentifier.value,
    }

    await axios.put(`/shift/api/tasks/${editTask.value.id}`, payload)
    closeEdit()
    await fetchTasks()
  } catch (e: any) {
    editError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to update task'
  } finally {
    editLoading.value = false
  }
}

function handleThreadSend(payload: { html: string }) {
  const html = payload?.html?.trim()
  if (!html) return
  threadMessages.value.push({
    id: Date.now(),
    author: window.shiftConfig?.username || 'You',
    time: 'Just now',
    content: html,
    isYou: true,
  })
  threadTempIdentifier.value = Date.now().toString()
}

function resetFilters() {
  selectedStatuses.value = [...defaultStatuses]
  selectedPriorities.value = priorityOptions.map((option) => option.value)
  searchTerm.value = ''
}

function selectAllStatuses() {
  selectedStatuses.value = statusOptions.map((option) => option.value)
}

function selectAllPriorities() {
  selectedPriorities.value = priorityOptions.map((option) => option.value)
}

async function fetchTasks() {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, any> = {}
    if (selectedStatuses.value.length && selectedStatuses.value.length < statusOptions.length) {
      params.status = selectedStatuses.value
    }
    const response = await axios.get('/shift/api/tasks', { params })
    if (Array.isArray(response.data?.data)) {
      tasks.value = response.data.data
      totalTasks.value = response.data.total ?? response.data.data.length
    } else if (Array.isArray(response.data)) {
      tasks.value = response.data
      totalTasks.value = response.data.length
    } else {
      tasks.value = []
      totalTasks.value = 0
    }
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

const filteredTasks = computed(() => {
  let list = [...tasks.value]

  if (selectedStatuses.value.length === 0) return []
  if (selectedStatuses.value.length < statusOptions.length) {
    list = list.filter((task) => selectedStatuses.value.includes(task.status))
  }

  if (selectedPriorities.value.length === 0) return []
  if (selectedPriorities.value.length < priorityOptions.length) {
    list = list.filter((task) => selectedPriorities.value.includes(task.priority))
  }

  const query = searchTerm.value.trim().toLowerCase()
  if (query) {
    list = list.filter((task) => task.title.toLowerCase().includes(query))
  }

  return list
})

watch(selectedStatuses, () => {
  fetchTasks()
}, { deep: true })

async function deleteTask(taskId: number) {
  if (!confirm('Are you sure you want to delete this task?')) return

  deleteLoading.value = taskId
  error.value = null
  try {
    await axios.delete(`/shift/api/tasks/${taskId}`)
    tasks.value = tasks.value.filter((task) => task.id !== taskId)
    totalTasks.value = Math.max(totalTasks.value - 1, 0)
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message || 'Failed to delete task'
  } finally {
    deleteLoading.value = null
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'pending':
      return 'accent'
    case 'completed':
      return 'primary'
    case 'closed':
      return 'outline'
    default:
      return 'secondary'
  }
}

function getPriorityVariant(priority: string) {
  switch (priority) {
    case 'high':
      return 'destructive'
    case 'medium':
      return 'primary'
    default:
      return 'outline'
  }
}

onMounted(() => {
  fetchTasks()
})
</script>

<template>
  <Card class="w-full">
    <CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle>Tasks V2</CardTitle>
        <p class="text-sm text-muted-foreground">Default view hides completed and closed tasks.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Sheet v-model:open="filtersOpen">
          <SheetTrigger as-child>
            <Button variant="outline" size="sm" data-testid="filters-trigger">
              <Filter class="mr-2 h-4 w-4" />
              Filters
              <Badge v-if="activeFilterCount" variant="secondary" class="ml-2">
                {{ activeFilterCount }}
              </Badge>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" class="flex h-full w-[320px] flex-col p-0">
            <SheetHeader class="p-0">
              <div class="px-6 pt-6 pb-3">
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription class="mt-1 text-sm text-muted-foreground">
                  Refine your task list in real time.
                </SheetDescription>
              </div>
            </SheetHeader>
            <div class="flex-1 space-y-6 overflow-auto px-6 pb-6">
              <div class="space-y-2">
                <Label>Search</Label>
                <Input
                  v-model="searchTerm"
                  data-testid="filter-search"
                  placeholder="Search by title"
                />
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label>Status</Label>
                  <Button variant="ghost" size="sm" @click="selectAllStatuses">All</Button>
                </div>
                <div class="grid gap-2">
                  <label
                    v-for="option in statusOptions"
                    :key="option.value"
                    class="flex items-center gap-2 text-sm"
                  >
                    <input
                      v-model="selectedStatuses"
                      type="checkbox"
                      :value="option.value"
                      :data-testid="`status-${option.value}`"
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label>Priority</Label>
                  <Button variant="ghost" size="sm" @click="selectAllPriorities">All</Button>
                </div>
                <div class="grid gap-2">
                  <label
                    v-for="option in priorityOptions"
                    :key="option.value"
                    class="flex items-center gap-2 text-sm"
                  >
                    <input
                      v-model="selectedPriorities"
                      type="checkbox"
                      :value="option.value"
                      :data-testid="`priority-${option.value}`"
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
              <Button variant="ghost" @click="resetFilters">Reset</Button>
              <Button variant="default" @click="filtersOpen = false">Apply</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Button variant="default" size="sm" @click="openCreate">
          <Plus class="mr-2 h-4 w-4" />
          Create
        </Button>
      </div>
    </CardHeader>

    <CardContent>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Showing {{ filteredTasks.length }} of {{ totalTasks }} tasks</span>
        <span v-if="activeFilterCount">{{ activeFilterCount }} filter{{ activeFilterCount === 1 ? '' : 's' }} active</span>
      </div>

      <div v-if="loading" class="py-8 text-center text-muted-foreground">Loading...</div>
      <div v-else-if="error" class="py-8 text-center text-destructive">{{ error }}</div>
      <div v-else-if="filteredTasks.length === 0" class="py-8 text-center text-muted-foreground">No tasks found</div>

      <ul v-else class="divide-y divide-border">
        <li
          v-for="task in filteredTasks"
          :key="task.id"
          data-testid="task-row"
          class="flex flex-col gap-3 py-4 transition sm:flex-row sm:items-center sm:gap-4"
          :class="
            highlightedTaskId === task.id
              ? 'rounded-lg bg-sky-500/10 ring-2 ring-sky-500/40 ring-offset-2 ring-offset-background'
              : ''
          "
        >
          <div class="flex-1">
            <div class="text-lg font-medium text-card-foreground">{{ task.title }}</div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge :variant="getStatusVariant(task.status)">{{ task.status }}</Badge>
              <Badge :variant="getPriorityVariant(task.priority)">{{ task.priority }}</Badge>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              title="Edit"
              @click="openEdit(task.id)"
            >
              <Pencil class="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              :disabled="deleteLoading === task.id"
              title="Delete"
              @click="deleteTask(task.id)"
            >
              <span v-if="deleteLoading === task.id">Deleting...</span>
              <Trash2 v-else class="h-4 w-4" />
            </Button>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>

  <Sheet v-model:open="createOpen">
    <SheetContent side="right" class="flex h-full w-full max-w-none flex-col p-0 sm:w-1/2 sm:max-w-none lg:w-1/3">
      <form class="flex h-full flex-col" @submit.prevent="createTask">
        <SheetHeader class="p-0">
          <div class="px-6 pt-6 pb-3">
            <SheetTitle>Create Task</SheetTitle>
            <SheetDescription class="mt-1 text-sm text-muted-foreground">
              Add a new task to your project queue.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div class="flex-1 space-y-6 overflow-auto px-6 pb-6">
          <div class="space-y-2">
            <Label>Title</Label>
            <Input v-model="createForm.title" placeholder="Short, descriptive title" required />
          </div>

          <div class="space-y-2">
            <Label>Priority</Label>
            <Select v-model="createForm.priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Description</Label>
            <ShiftEditor
              v-model="createForm.description"
              :temp-identifier="createTempIdentifier"
              :min-height="180"
              :axios-instance="axios"
              :upload-endpoints="uploadEndpoints"
              :remove-temp-url="removeTempUrl"
              :resolve-temp-url="resolveTempUrl"
              placeholder="Write the full task details, then drag files into the editor."
              @uploading="createUploading = $event"
            />
          </div>

          <div v-if="createError" class="text-sm text-red-600">
            {{ createError }}
          </div>
        </div>

        <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
          <Button variant="outline" type="button" @click="closeCreate">Cancel</Button>
          <Button :disabled="createLoading || createUploading" variant="default" type="submit">
            <Plus class="mr-2 h-4 w-4" />
            {{ createLoading ? 'Creating...' : 'Create' }}
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>

  <Sheet v-model:open="editOpen">
    <SheetContent side="right" class="flex h-full w-full max-w-none flex-col p-0 sm:w-1/2 sm:max-w-none">
      <form class="flex h-full flex-col" @submit.prevent="saveEdit">
        <SheetHeader class="p-0">
          <div class="px-6 pt-6 pb-3">
            <SheetTitle>Task Details</SheetTitle>
            <SheetDescription class="mt-1 text-sm text-muted-foreground">
              Review updates and keep the comments moving.
            </SheetDescription>
          </div>
        </SheetHeader>

        <div class="flex-1 overflow-hidden px-6 pb-6" @click="onRichContentClick">
          <div v-if="editLoading" class="py-8 text-center text-muted-foreground">Loading task...</div>
          <div v-else-if="editError" class="py-8 text-center text-destructive">{{ editError }}</div>
          <div v-else-if="editTask" class="grid h-full gap-6 lg:grid-cols-2">
            <div class="space-y-6 overflow-auto pr-1">
              <div class="space-y-2">
                <Label>Title</Label>
                <template v-if="isOwner">
                  <Input v-model="editForm.title" placeholder="Short, descriptive title" required />
                </template>
                <template v-else>
                  <div class="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-3 text-sm text-muted-foreground">
                    {{ editTask.title }}
                  </div>
                </template>
              </div>

              <div class="space-y-2">
                <Label>Priority</Label>
                <template v-if="isOwner">
                  <Select v-model="editForm.priority">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </template>
                <template v-else>
                  <div class="inline-flex items-center gap-2 rounded-md border border-muted-foreground/30 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
                    {{ editTask.priority }}
                  </div>
                </template>
              </div>

              <div class="space-y-2">
                <Label>Description</Label>
                <template v-if="isOwner">
                  <ShiftEditor
                    v-model="editForm.description"
                    :temp-identifier="editTempIdentifier"
                    :axios-instance="axios"
                    :upload-endpoints="uploadEndpoints"
                    :remove-temp-url="removeTempUrl"
                    :resolve-temp-url="resolveTempUrl"
                    placeholder="Update the task details and drag files inline."
                    @uploading="editUploading = $event"
                  />
                </template>
                <template v-else>
                  <div class="rounded-lg border border-muted-foreground/30 bg-muted/10 p-4 text-sm text-muted-foreground">
                    <div
                      v-if="editTask.description"
                      class="tiptap shift-rich [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm"
                      v-html="editTask.description"
                    ></div>
                    <div v-else>No description provided.</div>
                  </div>
                </template>
              </div>

              <div class="space-y-2">
                <Label>Attachments</Label>
                <div v-if="nonImageAttachments.length" class="space-y-2">
                  <a
                    v-for="attachment in nonImageAttachments"
                    :key="attachment.id"
                    :href="attachment.url"
                    class="flex items-center justify-between rounded-md border border-muted-foreground/20 bg-muted/10 px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/20"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span class="truncate">{{ attachment.original_filename }}</span>
                    <span class="text-xs uppercase">Download</span>
                  </a>
                </div>
                <div v-else class="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-3 text-sm text-muted-foreground">
                  No non-image attachments.
                </div>
              </div>
            </div>

            <div class="flex h-full flex-col overflow-hidden rounded-2xl border border-muted-foreground/10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/5 via-background to-background">
              <div class="flex items-center justify-between border-b border-muted-foreground/10 px-4 py-3">
                <div>
                  <h3 class="text-sm font-semibold text-foreground">Comments</h3>
                  <p class="text-xs text-muted-foreground">Signal-style thread</p>
                </div>
                <div class="text-xs text-muted-foreground">{{ threadMessages.length }} message{{ threadMessages.length === 1 ? '' : 's' }}</div>
              </div>

              <div
                ref="commentsScrollRef"
                class="flex-1 space-y-3 overflow-auto px-4 py-4"
              >
                <div
                  v-for="message in threadMessages"
                  :key="message.id"
                  class="flex"
                  :class="message.isYou ? 'justify-end' : 'justify-start'"
                >
                  <div class="max-w-[86%]">
                    <div
                      class="rounded-2xl px-3 py-2 text-sm shadow-sm"
                      :class="
                        message.isYou
                          ? 'rounded-br-md bg-sky-600 text-white'
                          : 'rounded-bl-md border border-muted-foreground/10 bg-background/70 text-foreground'
                      "
                    >
                      <div v-if="!message.isYou" class="mb-1 text-[11px] font-semibold text-foreground/80">
                        {{ message.author }}
                      </div>
                      <div
                        class="shift-rich text-inherit [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm"
                        v-html="message.content"
                      ></div>
                    </div>
                    <div
                      class="mt-1 text-[11px] text-muted-foreground"
                      :class="message.isYou ? 'text-right' : 'text-left'"
                    >
                      {{ message.time }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="border-t border-muted-foreground/10 bg-background/80 px-4 py-3 backdrop-blur">
                <Label class="mb-2 block text-xs text-muted-foreground">Reply</Label>
                <ShiftEditor
                  :temp-identifier="threadTempIdentifier"
                  :axios-instance="axios"
                  :upload-endpoints="uploadEndpoints"
                  :remove-temp-url="removeTempUrl"
                  :resolve-temp-url="resolveTempUrl"
                  placeholder="Write a comment..."
                  @send="handleThreadSend"
                />
              </div>
            </div>
          </div>
        </div>

        <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
          <Button variant="outline" type="button" @click="closeEdit">Close</Button>
          <Button
            v-if="isOwner"
            :disabled="editLoading || editUploading"
            variant="default"
            type="submit"
          >
            Save
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>

  <ImageLightbox v-model:open="lightboxOpen" :src="lightboxSrc" :alt="lightboxAlt" />
</template>
