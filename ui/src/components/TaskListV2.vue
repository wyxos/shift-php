<script lang="ts" setup>
/* eslint-disable max-lines */
import axios from '@/axios-config';
import ShiftEditor from '@shared/components/ShiftEditor.vue';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shift/ui/card';
import { Input } from '@shift/ui/input';
import { Label } from '@shift/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@shift/ui/sheet';
import { Filter, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuSeparator, ContextMenuTrigger } from 'reka-ui';
import { toast } from 'vue-sonner';
import Badge from './ui/badge.vue';
import ImageLightbox from './ui/ImageLightbox.vue';
import ButtonGroup from './ui/ButtonGroup.vue';

type Task = {
    id: number;
    title: string;
    status: string;
    priority: string;
};

type TaskAttachment = {
    id: number;
    original_filename: string;
    url?: string;
    path?: string;
};

type TaskDetail = Task & {
    description?: string;
    created_at?: string;
    submitter?: { name?: string; email?: string };
    attachments?: TaskAttachment[];
};

type ThreadMessage = {
    clientId: string;
    id?: number;
    author: string;
    time: string;
    content: string;
    isYou?: boolean;
    pending?: boolean;
    failed?: boolean;
    attachments?: TaskAttachment[];
};

const tasks = ref<Task[]>([]);
const totalTasks = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);
const deleteLoading = ref<number | null>(null);
const filtersOpen = ref(false);
const highlightedTaskId = ref<number | null>(null);
let highlightTimer: number | null = null;

const createOpen = ref(false);
const createLoading = ref(false);
const createError = ref<string | null>(null);
const createUploading = ref(false);
const createTempIdentifier = ref(Date.now().toString());
const createForm = ref({
    title: '',
    priority: 'medium',
    description: '',
});

const editOpen = ref(false);
const editLoading = ref(false);
const editError = ref<string | null>(null);
const editUploading = ref(false);
const editTempIdentifier = ref(Date.now().toString());
const editTask = ref<TaskDetail | null>(null);
const deletedAttachmentIds = ref<number[]>([]);
const editForm = ref({
    title: '',
    priority: 'medium',
    description: '',
});
const editStatus = ref<string>('pending');
const statusSaving = ref(false);
const statusError = ref<string | null>(null);

const threadTempIdentifier = ref(Date.now().toString());
const threadLoading = ref(false);
const threadSending = ref(false);
const threadError = ref<string | null>(null);
const threadMessages = ref<ThreadMessage[]>([]);

const threadComposerRef = ref<InstanceType<typeof ShiftEditor> | null>(null);
const threadComposerHtml = ref('');
const threadComposerUploading = ref(false);
const threadEditingId = ref<number | null>(null);
const threadEditSaving = ref(false);
const threadEditError = ref<string | null>(null);
const lastTouchTapAt = ref(0);
const lastTouchTapId = ref<number | null>(null);

const commentsScrollRef = ref<HTMLElement | null>(null);

const lightboxOpen = ref(false);
const lightboxSrc = ref('');
const lightboxAlt = ref('');

function getShiftUserEmail(): string | null {
    const email = (window.shiftConfig as any)?.email;
    if (typeof email === 'string' && email.trim()) return email.trim();
    return null;
}

function getTaskCreatorEmail(task: any): string | null {
    const candidates = [
        task?.submitter?.email,
        task?.submitter_email,
        task?.creator?.email,
        task?.creator_email,
        task?.created_by?.email,
        task?.created_by_email,
        task?.user?.email,
        task?.user_email,
    ];
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}

function openLightboxForImage(img: HTMLImageElement) {
    const src = img.currentSrc || img.src;
    if (!src) return;
    lightboxSrc.value = src;
    lightboxAlt.value = img.alt || img.title || 'Image';
    lightboxOpen.value = true;
}

function onRichContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const img = target.closest('img') as HTMLImageElement | null;
    if (!img) return;
    // Only intercept images inside rich html blocks (editor tiles, rendered descriptions, thread content).
    const inRich = Boolean(img.closest('.shift-rich')) || Boolean(img.closest('.tiptap')) || img.classList.contains('editor-tile');
    if (!inRich) return;
    event.preventDefault();
    event.stopPropagation();
    openLightboxForImage(img);
}

function shouldHandleImage(img: HTMLImageElement) {
    const inRich = Boolean(img.closest('.shift-rich')) || Boolean(img.closest('.tiptap')) || img.classList.contains('editor-tile');
    if (!inRich) return { ok: false, inEditable: false };
    const inEditable = Boolean(img.closest('[contenteditable="true"]'));
    return { ok: true, inEditable };
}

function onGlobalClickCapture(event: MouseEvent) {
    if (!editOpen.value) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const img = target.closest('img') as HTMLImageElement | null;
    if (!img) return;
    const { ok, inEditable } = shouldHandleImage(img);
    if (!ok || inEditable) return;
    event.preventDefault();
    event.stopPropagation();
    openLightboxForImage(img);
}

function onGlobalDblClickCapture(event: MouseEvent) {
    if (!editOpen.value) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const img = target.closest('img') as HTMLImageElement | null;
    if (!img) return;
    const { ok, inEditable } = shouldHandleImage(img);
    if (!ok || !inEditable) return;
    event.preventDefault();
    event.stopPropagation();
    openLightboxForImage(img);
}

function onGlobalKeyDownCapture(event: KeyboardEvent) {
    if (!editOpen.value) return;
    if (!threadEditingId.value) return;
    if (event.key !== 'Escape') return;

    // Escape should cancel edit mode (and not close the sheet).
    event.preventDefault();
    event.stopPropagation();
    (event as any).stopImmediatePropagation?.();
    cancelThreadEdit();
}

function scrollCommentsToBottom() {
    const el = commentsScrollRef.value;
    if (!el) return;
    if (typeof (el as any).scrollTo === 'function') {
        (el as any).scrollTo({ top: el.scrollHeight, behavior: 'auto' });
        return;
    }
    el.scrollTop = el.scrollHeight;
}

function scrollCommentsToBottomSoon() {
    // Comments include images that may load after the HTML is inserted, changing scrollHeight.
    // Do a few attempts so "open edit" reliably lands on the latest message.
    void nextTick().then(scrollCommentsToBottom);
    const raf = globalThis.requestAnimationFrame ?? ((cb: FrameRequestCallback) => window.setTimeout(cb, 0));
    raf(scrollCommentsToBottom);
    window.setTimeout(scrollCommentsToBottom, 50);
    window.setTimeout(scrollCommentsToBottom, 250);
}

function onCommentsMediaLoadCapture(event: Event) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName?.toLowerCase();
    if (tag !== 'img' && tag !== 'video') return;
    scrollCommentsToBottomSoon();
}

function formatThreadTime(value: any): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startToday.getDate() - 1);

    const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);

    if (date >= startToday) {
        return time;
    }

    if (date >= startYesterday && date < startToday) {
        return `Yesterday - ${time}`;
    }

    const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date);
    return `${day} ${month} ${time}`;
}

function mapThreadToMessage(thread: any): ThreadMessage {
    const id = typeof thread?.id === 'number' ? (thread.id as number) : undefined;
    const author = String(thread?.sender_name ?? thread?.author ?? 'Unknown');
    const isYou = Boolean(thread?.is_current_user ?? thread?.isYou);
    const content = String(thread?.content ?? '');
    const time = formatThreadTime(thread?.created_at);
    const attachments = Array.isArray(thread?.attachments) ? (thread.attachments as TaskAttachment[]) : [];
    return {
        clientId: id ? `thread-${id}` : `thread-${Date.now()}`,
        id,
        author,
        time,
        content,
        isYou,
        attachments,
    };
}

async function fetchThreads(taskId: number) {
    threadLoading.value = true;
    threadError.value = null;
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}/threads`);
        const payload = response.data?.data ?? response.data;
        const list = Array.isArray(payload?.external) ? payload.external : [];
        threadMessages.value = list.map(mapThreadToMessage);
        scrollCommentsToBottomSoon();
    } catch (e: any) {
        threadError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to load comments';
    } finally {
        threadLoading.value = false;
    }
}

watch(editOpen, async (open) => {
    if (!open) return;
    scrollCommentsToBottomSoon();
});

watch(
    () => threadMessages.value.length,
    async () => {
        if (!editOpen.value) return;
        scrollCommentsToBottomSoon();
    },
);

function highlightTask(taskId: number) {
    highlightedTaskId.value = taskId;
    if (highlightTimer) window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
        highlightedTaskId.value = null;
        highlightTimer = null;
    }, 4500);
}

onMounted(() => {
    // Capture phase so we can open the preview even if the editor stops propagation.
    document.addEventListener('click', onGlobalClickCapture, true);
    document.addEventListener('dblclick', onGlobalDblClickCapture, true);
    document.addEventListener('keydown', onGlobalKeyDownCapture, true);
});

onBeforeUnmount(() => {
    if (highlightTimer) window.clearTimeout(highlightTimer);
    document.removeEventListener('click', onGlobalClickCapture, true);
    document.removeEventListener('dblclick', onGlobalDblClickCapture, true);
    document.removeEventListener('keydown', onGlobalKeyDownCapture, true);
});

const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'awaiting-feedback', label: 'Awaiting Feedback' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
];

const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

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

const defaultStatuses = statusOptions.filter((option) => !['completed', 'closed'].includes(option.value)).map((option) => option.value);

const selectedStatuses = ref<string[]>([...defaultStatuses]);
const selectedPriorities = ref<string[]>(priorityOptions.map((option) => option.value));
const searchTerm = ref('');

const activeFilterCount = computed(() => {
    let count = 0;
    if (selectedStatuses.value.length && selectedStatuses.value.length < statusOptions.length) count += 1;
    if (selectedPriorities.value.length && selectedPriorities.value.length < priorityOptions.length) count += 1;
    if (searchTerm.value.trim()) count += 1;
    return count;
});

const isOwner = computed(() => {
    const currentEmail = getShiftUserEmail();
    const submitterEmail = getTaskCreatorEmail(editTask.value);
    if (!currentEmail || !submitterEmail) return false;
    return currentEmail.toLowerCase() === submitterEmail.toLowerCase();
});

const taskAttachments = computed(() => {
    if (!editTask.value?.attachments) return [];
    const removed = new Set(deletedAttachmentIds.value);
    return editTask.value.attachments.filter((attachment) => !removed.has(attachment.id));
});

function resetCreateForm() {
    createForm.value = {
        title: '',
        priority: 'medium',
        description: '',
    };
    createTempIdentifier.value = Date.now().toString();
    createError.value = null;
    createUploading.value = false;
}

function openCreate() {
    resetCreateForm();
    createOpen.value = true;
}

function closeCreate() {
    createOpen.value = false;
}

function removeAttachmentFromTask(attachmentId: number) {
    if (!deletedAttachmentIds.value.includes(attachmentId)) {
        deletedAttachmentIds.value = [...deletedAttachmentIds.value, attachmentId];
    }
}

async function createTask() {
    createError.value = null;
    createLoading.value = true;

    try {
        const source_url = window.location.origin;
        const environment = import.meta.env.VITE_APP_ENV || 'production';

        const payload = {
            title: createForm.value.title,
            description: createForm.value.description,
            priority: createForm.value.priority,
            source_url,
            environment,
            temp_identifier: createTempIdentifier.value,
        };

        const response = await axios.post('/shift/api/tasks', payload);
        const created = response.data?.data ?? response.data;
        const createdId = typeof created?.id === 'number' ? (created.id as number) : null;
        closeCreate();
        await fetchTasks();
        if (createdId) highlightTask(createdId);
        toast.success('Task created', { description: 'Your task has been added to the queue.' });
    } catch (e: any) {
        createError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error';
    } finally {
        createLoading.value = false;
    }
}

async function openEdit(taskId: number) {
    editOpen.value = true;
    editLoading.value = true;
    editError.value = null;
    editTask.value = null;
    editUploading.value = false;
    threadMessages.value = [];
    threadError.value = null;
    threadTempIdentifier.value = Date.now().toString();
    deletedAttachmentIds.value = [];
    statusError.value = null;
    statusSaving.value = false;

    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}`);
        const data = response.data?.data ?? response.data;
        editTask.value = data;
        editStatus.value = data?.status ?? 'pending';
        editForm.value = {
            title: data?.title ?? '',
            priority: data?.priority ?? 'medium',
            description: data?.description ?? '',
        };
        editTempIdentifier.value = Date.now().toString();
        // Load comments in parallel so task details render immediately.
        void fetchThreads(taskId);
    } catch (e: any) {
        editError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to fetch task';
    } finally {
        editLoading.value = false;
    }
}

function closeEdit() {
    editOpen.value = false;
    editTask.value = null;
    editError.value = null;
    editUploading.value = false;
    threadMessages.value = [];
    threadError.value = null;
    deletedAttachmentIds.value = [];
    editStatus.value = 'pending';
    statusError.value = null;
    statusSaving.value = false;
}

async function saveStatus(nextStatus: string) {
    if (!editTask.value) return;
    if (!nextStatus) return;
    if (statusSaving.value) return;

    const prevStatus = editTask.value.status;
    if (nextStatus === prevStatus) return;

    statusSaving.value = true;
    statusError.value = null;

    try {
        await axios.patch(`/shift/api/tasks/${editTask.value.id}/toggle-status`, { status: nextStatus });
        editTask.value.status = nextStatus;
        const idx = tasks.value.findIndex((t) => t.id === editTask.value?.id);
        if (idx !== -1) {
            tasks.value[idx] = {
                ...tasks.value[idx],
                status: nextStatus,
            };
        }
    } catch (e: any) {
        statusError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to update status';
        editStatus.value = prevStatus;
    } finally {
        statusSaving.value = false;
    }
}

function onEditStatusSelected(nextStatus: string) {
    editStatus.value = nextStatus;
    void saveStatus(nextStatus);
}

async function saveEdit() {
    if (!editTask.value || !isOwner.value) return;

    editError.value = null;
    editLoading.value = true;

    try {
        const payload = {
            title: editForm.value.title,
            description: editForm.value.description,
            priority: editForm.value.priority,
            temp_identifier: editTempIdentifier.value,
            deleted_attachment_ids: deletedAttachmentIds.value.length ? deletedAttachmentIds.value : undefined,
        };

        await axios.put(`/shift/api/tasks/${editTask.value.id}`, payload);
        closeEdit();
        await fetchTasks();
    } catch (e: any) {
        editError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to update task';
    } finally {
        editLoading.value = false;
    }
}

async function handleThreadSend(payload: { html: string; attachments?: any[] }) {
    if (!editTask.value) return;
    if (threadComposerUploading.value) return;
    if (threadSending.value || threadEditSaving.value) return;
    const html = payload?.html?.trim();
    if (!html) return;

    if (threadEditingId.value) {
        threadEditSaving.value = true;
        threadEditError.value = null;
        try {
            const response = await axios.put(`/shift/api/tasks/${editTask.value.id}/threads/${threadEditingId.value}`, {
                content: html,
                temp_identifier: threadTempIdentifier.value,
            });

            const data = response.data?.data ?? response.data;
            const thread = data?.thread ?? data;
            const serverMsg = mapThreadToMessage(thread);
            threadMessages.value = threadMessages.value.map((m) =>
                m.id === threadEditingId.value ? { ...m, content: serverMsg.content, attachments: serverMsg.attachments } : m,
            );

            threadEditingId.value = null;
            threadTempIdentifier.value = Date.now().toString();
            threadComposerHtml.value = '';
            threadComposerRef.value?.reset?.();
            scrollCommentsToBottomSoon();
        } catch (e: any) {
            threadEditError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to update comment';
        } finally {
            threadEditSaving.value = false;
        }
        return;
    }

    const localId = `local-${Date.now()}`;
    const optimistic: ThreadMessage = {
        clientId: localId,
        author: window.shiftConfig?.username || 'You',
        time: 'Sending...',
        content: html,
        isYou: true,
        pending: true,
        failed: false,
    };
    threadMessages.value = [...threadMessages.value, optimistic];

    try {
        threadSending.value = true;
        const response = await axios.post(`/shift/api/tasks/${editTask.value.id}/threads`, {
            content: html,
            temp_identifier: threadTempIdentifier.value,
        });
        const data = response.data?.data ?? response.data;
        const thread = data?.thread ?? data;
        const serverMsg = mapThreadToMessage(thread);
        threadMessages.value = [...threadMessages.value.filter((m) => m.clientId !== localId), serverMsg];
        threadTempIdentifier.value = Date.now().toString();
        threadComposerHtml.value = '';
        threadComposerRef.value?.reset?.();
        scrollCommentsToBottomSoon();
    } catch (e: any) {
        threadMessages.value = threadMessages.value.map((m) =>
            m.clientId === localId ? { ...m, pending: false, failed: true, time: 'Failed to send' } : m,
        );
        toast.error('Failed to send comment', {
            description: e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error',
        });
    } finally {
        threadSending.value = false;
    }
}

function startThreadEdit(message: ThreadMessage) {
    if (!editTask.value) return;
    if (!message.id || !message.isYou || message.pending) return;

    threadEditingId.value = message.id;
    threadEditError.value = null;
    threadTempIdentifier.value = Date.now().toString();
    threadComposerHtml.value = message.content;

    void nextTick().then(() => {
        threadComposerRef.value?.editor?.chain().focus().run();
        scrollCommentsToBottomSoon();
    });
}

function cancelThreadEdit() {
    threadEditingId.value = null;
    threadComposerHtml.value = '';
    threadEditError.value = null;
    threadEditSaving.value = false;
    threadTempIdentifier.value = Date.now().toString();
    threadComposerRef.value?.reset?.();
}

function shouldIgnoreEditGesture(event: Event): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    if (target.closest('img')) return true;
    if (target.closest('a')) return true;
    if (target.closest('button')) return true;
    return false;
}

function onMessageDblClick(message: ThreadMessage, event: MouseEvent) {
    if (shouldIgnoreEditGesture(event)) return;
    startThreadEdit(message);
}

function onMessageTouchEnd(message: ThreadMessage, event: TouchEvent) {
    if (shouldIgnoreEditGesture(event)) return;
    if (!message.isYou || !message.id || message.pending) return;

    const now = Date.now();
    const within = now - lastTouchTapAt.value < 320;
    const same = lastTouchTapId.value === message.id;

    lastTouchTapAt.value = now;
    lastTouchTapId.value = message.id;

    if (within && same) {
        startThreadEdit(message);
        lastTouchTapAt.value = 0;
        lastTouchTapId.value = null;
    }
}

async function deleteThreadMessage(message: ThreadMessage) {
    if (!editTask.value) return;
    if (!message.id || !message.isYou || message.pending) return;
    if (!confirm('Delete this message?')) return;

    try {
        await axios.delete(`/shift/api/tasks/${editTask.value.id}/threads/${message.id}`);
        threadMessages.value = threadMessages.value.filter((m) => m.id !== message.id);
        if (threadEditingId.value === message.id) {
            cancelThreadEdit();
        }
    } catch (e: any) {
        toast.error('Failed to delete comment', {
            description: e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error',
        });
    }
}

function resetFilters() {
    selectedStatuses.value = [...defaultStatuses];
    selectedPriorities.value = priorityOptions.map((option) => option.value);
    searchTerm.value = '';
}

function selectAllStatuses() {
    selectedStatuses.value = statusOptions.map((option) => option.value);
}

function selectAllPriorities() {
    selectedPriorities.value = priorityOptions.map((option) => option.value);
}

async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
        const params: Record<string, any> = {};
        if (selectedStatuses.value.length && selectedStatuses.value.length < statusOptions.length) {
            params.status = selectedStatuses.value;
        }
        const response = await axios.get('/shift/api/tasks', { params });
        if (Array.isArray(response.data?.data)) {
            tasks.value = response.data.data;
            totalTasks.value = response.data.total ?? response.data.data.length;
        } else if (Array.isArray(response.data)) {
            tasks.value = response.data;
            totalTasks.value = response.data.length;
        } else {
            tasks.value = [];
            totalTasks.value = 0;
        }
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

const filteredTasks = computed(() => {
    let list = [...tasks.value];

    if (selectedStatuses.value.length === 0) return [];
    if (selectedStatuses.value.length < statusOptions.length) {
        list = list.filter((task) => selectedStatuses.value.includes(task.status));
    }

    if (selectedPriorities.value.length === 0) return [];
    if (selectedPriorities.value.length < priorityOptions.length) {
        list = list.filter((task) => selectedPriorities.value.includes(task.priority));
    }

    const query = searchTerm.value.trim().toLowerCase();
    if (query) {
        list = list.filter((task) => task.title.toLowerCase().includes(query));
    }

    return list;
});

watch(
    selectedStatuses,
    () => {
        fetchTasks();
    },
    { deep: true },
);

async function deleteTask(taskId: number) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    deleteLoading.value = taskId;
    error.value = null;
    try {
        await axios.delete(`/shift/api/tasks/${taskId}`);
        tasks.value = tasks.value.filter((task) => task.id !== taskId);
        totalTasks.value = Math.max(totalTasks.value - 1, 0);
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Failed to delete task';
    } finally {
        deleteLoading.value = null;
    }
}

function getStatusVariant(status: string) {
    switch (status) {
        case 'pending':
            return 'accent';
        case 'completed':
            return 'primary';
        case 'closed':
            return 'outline';
        default:
            return 'secondary';
    }
}

function getPriorityVariant(priority: string) {
    switch (priority) {
        case 'high':
            return 'destructive';
        case 'medium':
            return 'primary';
        default:
            return 'outline';
    }
}

onMounted(() => {
    fetchTasks();
});
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <CardTitle>Tasks V2</CardTitle>
                <p class="text-muted-foreground text-sm">Default view hides completed and closed tasks.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <Sheet v-model:open="filtersOpen">
                    <SheetTrigger as-child>
                        <Button data-testid="filters-trigger" size="sm" variant="outline">
                            <Filter class="mr-2 h-4 w-4" />
                            Filters
                            <Badge v-if="activeFilterCount" class="ml-2" variant="secondary">
                                {{ activeFilterCount }}
                            </Badge>
                        </Button>
                    </SheetTrigger>
                    <SheetContent class="flex h-full w-[320px] flex-col p-0" side="right">
                        <SheetHeader class="p-0">
                            <div class="px-6 pt-6 pb-3">
                                <SheetTitle>Filters</SheetTitle>
                                <SheetDescription class="text-muted-foreground mt-1 text-sm"> Refine your task list in real time. </SheetDescription>
                            </div>
                        </SheetHeader>
                        <div class="flex-1 space-y-6 overflow-auto px-6 pb-6">
                            <div class="space-y-2">
                                <Label>Search</Label>
                                <Input v-model="searchTerm" data-testid="filter-search" placeholder="Search by title" />
                            </div>

                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <Label>Status</Label>
                                    <Button size="sm" variant="ghost" @click="selectAllStatuses">All</Button>
                                </div>
                                <div class="grid gap-2">
                                    <label v-for="option in statusOptions" :key="option.value" class="flex items-center gap-2 text-sm">
                                        <input
                                            v-model="selectedStatuses"
                                            :data-testid="`status-${option.value}`"
                                            :value="option.value"
                                            type="checkbox"
                                        />
                                        <span>{{ option.label }}</span>
                                    </label>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <Label>Priority</Label>
                                    <Button size="sm" variant="ghost" @click="selectAllPriorities">All</Button>
                                </div>
                                <div class="grid gap-2">
                                    <label v-for="option in priorityOptions" :key="option.value" class="flex items-center gap-2 text-sm">
                                        <input
                                            v-model="selectedPriorities"
                                            :data-testid="`priority-${option.value}`"
                                            :value="option.value"
                                            type="checkbox"
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

                <Button size="sm" variant="default" @click="openCreate">
                    <Plus class="mr-2 h-4 w-4" />
                    Create
                </Button>
            </div>
        </CardHeader>

        <CardContent>
            <div class="text-muted-foreground mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>Showing {{ filteredTasks.length }} of {{ totalTasks }} tasks</span>
                <span v-if="activeFilterCount">{{ activeFilterCount }} filter{{ activeFilterCount === 1 ? '' : 's' }} active</span>
            </div>

            <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading...</div>
            <div v-else-if="error" class="text-destructive py-8 text-center">{{ error }}</div>
            <div v-else-if="filteredTasks.length === 0" class="text-muted-foreground py-8 text-center">No tasks found</div>

            <ul v-else class="divide-border divide-y">
                <li
                    v-for="task in filteredTasks"
                    :key="task.id"
                    :class="
                        highlightedTaskId === task.id ? 'ring-offset-background rounded-lg bg-sky-500/10 ring-2 ring-sky-500/40 ring-offset-2' : ''
                    "
                    class="flex flex-col gap-3 py-4 transition sm:flex-row sm:items-center sm:gap-4"
                    data-testid="task-row"
                >
                    <div class="flex-1">
                        <div class="text-card-foreground text-lg font-medium">{{ task.title }}</div>
                        <div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <Badge :variant="getStatusVariant(task.status)">{{ task.status }}</Badge>
                            <Badge :variant="getPriorityVariant(task.priority)">{{ task.priority }}</Badge>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button size="sm" title="Edit" variant="outline" @click="openEdit(task.id)">
                            <Pencil class="h-4 w-4" />
                        </Button>
                        <Button :disabled="deleteLoading === task.id" size="sm" title="Delete" variant="destructive" @click="deleteTask(task.id)">
                            <span v-if="deleteLoading === task.id">Deleting...</span>
                            <Trash2 v-else class="h-4 w-4" />
                        </Button>
                    </div>
                </li>
            </ul>
        </CardContent>
    </Card>

    <Sheet v-model:open="createOpen">
        <SheetContent class="flex h-full w-full max-w-none flex-col p-0 sm:w-1/2 sm:max-w-none lg:w-1/3" side="right">
            <form class="flex h-full flex-col" @submit.prevent="createTask">
                <SheetHeader class="p-0">
                    <div class="px-6 pt-6 pb-3">
                        <SheetTitle>Create Task</SheetTitle>
                        <SheetDescription class="text-muted-foreground mt-1 text-sm"> Add a new task to your project queue. </SheetDescription>
                    </div>
                </SheetHeader>

                <div class="flex-1 space-y-6 overflow-auto px-6 pb-6">
                    <div class="space-y-2">
                        <Label>Task</Label>
                        <Input v-model="createForm.title" placeholder="Short, descriptive title" required />
                    </div>

                    <div class="space-y-2">
                        <Label>Priority</Label>
                        <ButtonGroup v-model="createForm.priority" aria-label="Task priority" :options="priorityOptions" :columns="3" />
                    </div>

                    <div class="space-y-2">
                        <Label>Description</Label>
                        <ShiftEditor
                            v-model="createForm.description"
                            :axios-instance="axios"
                            :min-height="180"
                            :remove-temp-url="removeTempUrl"
                            :resolve-temp-url="resolveTempUrl"
                            :temp-identifier="createTempIdentifier"
                            :upload-endpoints="uploadEndpoints"
                            placeholder="Write the full task details, then drag files into the editor."
                            @uploading="createUploading = $event"
                        />
                    </div>

                    <div v-if="createError" class="text-sm text-red-600">
                        {{ createError }}
                    </div>
                </div>

                <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
                    <Button type="button" variant="outline" @click="closeCreate">Cancel</Button>
                    <Button :disabled="createLoading || createUploading" type="submit" variant="default">
                        <Plus class="mr-2 h-4 w-4" />
                        {{ createLoading ? 'Creating...' : 'Create' }}
                    </Button>
                </SheetFooter>
            </form>
        </SheetContent>
    </Sheet>

    <Sheet v-model:open="editOpen">
        <SheetContent class="flex h-full w-full max-w-none flex-col p-0 sm:w-1/2 sm:max-w-none" side="right">
            <form class="flex h-full flex-col" @submit.prevent="saveEdit">
                <!-- Keep an accessible title for the sheet without a visible header. -->
                <SheetHeader class="sr-only">
                    <SheetTitle>Task</SheetTitle>
                </SheetHeader>

                <div class="flex-1 overflow-hidden px-6 py-10" @click="onRichContentClick">
                    <div v-if="editLoading" class="text-muted-foreground py-8 text-center">Loading task...</div>
                    <div v-else-if="editError" class="text-destructive py-8 text-center">{{ editError }}</div>
                    <div v-else-if="editTask" class="grid h-full gap-6 lg:grid-cols-2">
                        <div class="space-y-6 overflow-auto pr-1">
                            <div v-if="editTask.created_at" class="text-muted-foreground text-xs">
                                Created {{ formatThreadTime(editTask.created_at) }}
                            </div>

                            <div class="space-y-2">
                                <Label>Task</Label>
                                <template v-if="isOwner">
                                    <Input v-model="editForm.title" placeholder="Short, descriptive title" required />
                                </template>
                                <template v-else>
                                    <div
                                        class="border-muted-foreground/30 bg-muted/10 text-muted-foreground rounded-md border border-dashed p-3 text-sm"
                                    >
                                        {{ editTask.title }}
                                    </div>
                                </template>
                            </div>

                            <div class="space-y-2">
                                <Label>Status</Label>
                                <ButtonGroup
                                    aria-label="Task status"
                                    test-id-prefix="task-status"
                                    :disabled="statusSaving"
                                    :model-value="editStatus"
                                    :options="statusOptions.filter((option) => option.value !== 'closed')"
                                    :columns="2"
                                    @update:modelValue="onEditStatusSelected"
                                />
                                <div v-if="statusError" class="text-destructive text-xs">{{ statusError }}</div>
                            </div>

                            <div class="space-y-2">
                                <Label>Priority</Label>
                                <template v-if="isOwner">
                                    <ButtonGroup v-model="editForm.priority" aria-label="Task priority" :options="priorityOptions" :columns="3" />
                                </template>
                                <template v-else>
                                    <div
                                        class="border-muted-foreground/30 bg-muted/10 text-muted-foreground inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                    >
                                        {{ editTask.priority }}
                                    </div>
                                </template>
                            </div>

                            <div class="space-y-2">
                                <Label>Description</Label>
                                <template v-if="isOwner">
                                    <ShiftEditor
                                        v-model="editForm.description"
                                        :axios-instance="axios"
                                        :remove-temp-url="removeTempUrl"
                                        :resolve-temp-url="resolveTempUrl"
                                        :temp-identifier="editTempIdentifier"
                                        :upload-endpoints="uploadEndpoints"
                                        placeholder="Update the task details and drag files inline."
                                        @uploading="editUploading = $event"
                                    />
                                </template>
                                <template v-else>
                                    <div class="border-muted-foreground/30 bg-muted/10 text-muted-foreground rounded-lg border p-4 text-sm">
                                        <div
                                            v-if="editTask.description"
                                            class="tiptap shift-rich [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm [&_img.editor-tile]:aspect-square [&_img.editor-tile]:w-[200px] [&_img.editor-tile]:max-w-[200px] [&_img.editor-tile]:object-cover"
                                            v-html="editTask.description"
                                        ></div>
                                        <div v-else>No description provided.</div>
                                    </div>
                                </template>
                            </div>

                            <div class="space-y-2">
                                <Label>Attachments</Label>
                                <div v-if="taskAttachments.length" class="space-y-2">
                                    <div
                                        v-for="attachment in taskAttachments"
                                        :key="attachment.id"
                                        class="border-muted-foreground/20 bg-muted/10 text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                    >
                                        <a
                                            :href="attachment.url"
                                            class="hover:text-foreground min-w-0 flex-1 truncate transition"
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            {{ attachment.original_filename }}
                                        </a>
                                        <Button
                                            v-if="isOwner"
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                            @click="removeAttachmentFromTask(attachment.id)"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                                <div
                                    v-else
                                    class="border-muted-foreground/30 bg-muted/10 text-muted-foreground rounded-md border border-dashed p-3 text-sm"
                                >
                                    No attachments available
                                </div>
                            </div>
                        </div>

                        <div
                            class="border-muted-foreground/10 via-background to-background flex h-full flex-col overflow-hidden rounded-2xl border bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/5"
                        >
                            <div class="border-muted-foreground/10 flex items-center justify-between border-b px-4 py-3">
                                <div>
                                    <h3 class="text-foreground text-sm font-semibold">Comments</h3>
                                </div>
                                <div class="text-muted-foreground text-xs">
                                    {{ threadMessages.length }} message{{ threadMessages.length === 1 ? '' : 's' }}
                                </div>
                            </div>

                            <div ref="commentsScrollRef" class="flex-1 space-y-3 overflow-auto px-4 py-4" @load.capture="onCommentsMediaLoadCapture">
                                <div v-if="threadLoading" class="text-muted-foreground py-6 text-center text-sm">Loading comments...</div>
                                <div v-else-if="threadError" class="text-destructive py-6 text-center text-sm">{{ threadError }}</div>
                                <div v-else-if="threadMessages.length === 0" class="text-muted-foreground py-6 text-center text-sm">
                                    No comments yet.
                                </div>
                                <div
                                    v-for="message in threadMessages"
                                    :key="message.clientId"
                                    :class="message.isYou ? 'justify-end' : 'justify-start'"
                                    class="flex"
                                >
                                    <div class="max-w-[86%]">
                                        <ContextMenuRoot>
                                            <ContextMenuTrigger as-child>
                                                <div
                                                    :data-testid="message.id ? `comment-bubble-${message.id}` : undefined"
                                                    :class="
                                                        message.isYou
                                                            ? 'rounded-br-md bg-sky-600 text-white'
                                                            : 'border-muted-foreground/10 bg-background/70 text-foreground rounded-bl-md border'
                                                    "
                                                    class="rounded-2xl px-3 py-2 text-sm shadow-sm"
                                                    @dblclick="onMessageDblClick(message, $event)"
                                                    @touchend="onMessageTouchEnd(message, $event)"
                                                >
                                                    <div v-if="!message.isYou" class="text-foreground/80 mb-1 text-[11px] font-semibold">
                                                        {{ message.author }}
                                                    </div>
                                                    <div
                                                        class="shift-rich text-inherit [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm [&_img.editor-tile]:aspect-square [&_img.editor-tile]:w-[200px] [&_img.editor-tile]:max-w-[200px] [&_img.editor-tile]:object-cover"
                                                        v-html="message.content"
                                                    ></div>
                                                    <div v-if="message.attachments?.length" class="mt-2 space-y-1">
                                                        <a
                                                            v-for="attachment in message.attachments"
                                                            :key="attachment.id"
                                                            :href="attachment.url"
                                                            class="block truncate text-xs underline decoration-white/40 underline-offset-2 hover:decoration-white/70"
                                                            rel="noreferrer"
                                                            target="_blank"
                                                        >
                                                            {{ attachment.original_filename }}
                                                        </a>
                                                    </div>
                                                </div>
                                            </ContextMenuTrigger>
                                            <ContextMenuPortal>
                                                <ContextMenuContent
                                                    class="bg-popover text-popover-foreground z-50 min-w-[10rem] overflow-hidden rounded-md border p-1 shadow-md"
                                                >
                                                    <ContextMenuItem
                                                        v-if="message.isYou && message.id && !message.pending"
                                                        class="hover:bg-accent hover:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none"
                                                        @select="startThreadEdit(message)"
                                                    >
                                                        Edit
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator class="bg-border -mx-1 my-1 h-px" />
                                                    <ContextMenuItem
                                                        v-if="message.isYou && message.id && !message.pending"
                                                        class="text-destructive hover:bg-accent hover:text-destructive relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none"
                                                        @select="deleteThreadMessage(message)"
                                                    >
                                                        Delete
                                                    </ContextMenuItem>
                                                </ContextMenuContent>
                                            </ContextMenuPortal>
                                        </ContextMenuRoot>
                                        <div :class="message.isYou ? 'text-right' : 'text-left'" class="text-muted-foreground mt-1 text-[11px]">
                                            {{ message.time }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="border-muted-foreground/10 bg-background/80 border-t px-4 py-3 backdrop-blur">
                                <div v-if="threadEditError" class="text-destructive mb-2 text-xs">{{ threadEditError }}</div>
                                <Label class="text-muted-foreground mb-2 block text-xs">{{ threadEditingId ? 'Edit' : 'Reply' }}</Label>
                                <ShiftEditor
                                    ref="threadComposerRef"
                                    v-model="threadComposerHtml"
                                    :axios-instance="axios"
                                    :cancelable="Boolean(threadEditingId)"
                                    :clear-on-send="false"
                                    :remove-temp-url="removeTempUrl"
                                    :resolve-temp-url="resolveTempUrl"
                                    :temp-identifier="threadTempIdentifier"
                                    :upload-endpoints="uploadEndpoints"
                                    data-testid="comments-editor"
                                    :placeholder="threadEditingId ? 'Edit your comment...' : 'Write a comment...'"
                                    @cancel="cancelThreadEdit"
                                    @uploading="threadComposerUploading = $event"
                                    @send="handleThreadSend"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
                    <Button type="button" variant="outline" @click="closeEdit">Close</Button>
                    <Button v-if="isOwner" :disabled="editLoading || editUploading" type="submit" variant="default"> Save </Button>
                </SheetFooter>
            </form>
        </SheetContent>
    </Sheet>

    <ImageLightbox v-model:open="lightboxOpen" :alt="lightboxAlt" :src="lightboxSrc" />
</template>
