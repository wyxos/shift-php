<script setup lang="ts">
import axios from '@/axios-config';
import { Button } from '@shift/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@shift/ui/sheet';
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

type InboxItem = {
    id: number | string;
    type: string;
    title: string;
    body: string;
    task_id: number | null;
    thread_id: number | null;
    environment: string | null;
    read_at: string | null;
    created_at: string;
};

type InboxPage = {
    notifications: InboxItem[];
    unread_count: number;
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
};

const router = useRouter();
const open = ref(false);
const loaded = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const notifications = ref<InboxItem[]>([]);
const unreadCount = ref(0);
const currentPage = ref(1);
const lastPage = ref(1);
const total = ref(0);
const pending = ref(false);
let request: AbortController | null = null;

const hasUnread = computed(() => unreadCount.value > 0);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInbox(value: unknown): InboxPage {
    if (!isRecord(value) || !Array.isArray(value.notifications)) throw new Error('Invalid inbox response');
    const numbers = ['unread_count', 'current_page', 'last_page', 'total', 'per_page'] as const;
    if (numbers.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))) throw new Error('Invalid inbox response');

    const notifications = value.notifications.map((item: unknown): InboxItem => {
        if (!isRecord(item) || (typeof item.id !== 'string' && typeof item.id !== 'number') || typeof item.type !== 'string' || typeof item.title !== 'string' || typeof item.body !== 'string' || typeof item.created_at !== 'string') {
            throw new Error('Invalid notification');
        }
        const taskId = item.task_id;
        const threadId = item.thread_id;
        if (taskId !== null && typeof taskId !== 'number') throw new Error('Invalid notification');
        if (threadId !== null && typeof threadId !== 'number') throw new Error('Invalid notification');
        if (item.environment !== null && typeof item.environment !== 'string') throw new Error('Invalid notification');
        if (item.read_at !== null && typeof item.read_at !== 'string') throw new Error('Invalid notification');
        return {
            id: item.id,
            type: item.type,
            title: item.title,
            body: item.body,
            task_id: taskId,
            thread_id: threadId,
            environment: item.environment,
            read_at: item.read_at,
            created_at: item.created_at,
        };
    });

    return {
        notifications,
        unread_count: value.unread_count as number,
        current_page: value.current_page as number,
        last_page: value.last_page as number,
        total: value.total as number,
        per_page: value.per_page as number,
    };
}

async function loadInbox(page = currentPage.value) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    loading.value = true;
    error.value = null;
    try {
        const response = await axios.get<unknown>('/shift/api/inbox', {
            params: { page, per_page: 15 },
            signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const data = parseInbox(response.data);
        notifications.value = data.notifications;
        unreadCount.value = data.unread_count;
        currentPage.value = data.current_page;
        lastPage.value = data.last_page;
        total.value = data.total;
        loaded.value = true;
    } catch {
        if (!controller.signal.aborted) error.value = 'Notifications could not be loaded. Try again.';
    } finally {
        if (request === controller) {
            request = null;
            loading.value = false;
        }
    }
}

watch(open, (isOpen) => {
    if (isOpen) {
        actionError.value = null;
        void loadInbox(1);
    } else {
        request?.abort();
        request = null;
        loading.value = false;
    }
});

onBeforeUnmount(() => request?.abort());

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function markRead(item: InboxItem): Promise<boolean> {
    if (item.read_at) return true;
    pending.value = true;
    actionError.value = null;
    try {
        const response = await axios.patch<unknown>(`/shift/api/inbox/${encodeURIComponent(item.id)}/read`);
        if (!isRecord(response.data) || typeof response.data.unread_count !== 'number') throw new Error('Invalid response');
        item.read_at = new Date().toISOString();
        unreadCount.value = response.data.unread_count;
        return true;
    } catch {
        actionError.value = 'Could not mark this notification as read. Try again.';
        return false;
    } finally {
        pending.value = false;
    }
}

async function markAllRead() {
    if (pending.value || !hasUnread.value) return;
    pending.value = true;
    actionError.value = null;
    try {
        const response = await axios.patch<unknown>('/shift/api/inbox/read-all');
        if (!isRecord(response.data) || typeof response.data.unread_count !== 'number') throw new Error('Invalid response');
        notifications.value = notifications.value.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }));
        unreadCount.value = response.data.unread_count;
    } catch {
        actionError.value = 'Could not mark notifications as read. Try again.';
    } finally {
        pending.value = false;
    }
}

async function openTask(item: InboxItem) {
    if (pending.value || item.task_id === null) return;
    if (!(await markRead(item))) return;
    open.value = false;
    await router.push({ path: '/tasks', query: { task: String(item.task_id) } });
}
</script>

<template>
    <Sheet v-model:open="open">
        <SheetTrigger as-child>
            <Button
                variant="ghost"
                size="icon"
                class="relative size-9"
                type="button"
                :aria-label="loaded && hasUnread ? `Open notifications, ${unreadCount} unread` : 'Open notifications'"
                @click="open = true"
            >
                <Bell class="size-5" aria-hidden="true" />
                <span v-if="loaded && hasUnread" class="bg-primary text-primary-foreground absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                    {{ unreadCount > 99 ? '99+' : unreadCount }}
                </span>
            </Button>
        </SheetTrigger>

        <SheetContent side="right" class="gap-0 p-0 xl:min-w-[26rem] xl:max-w-[26rem]" aria-describedby="inbox-description">
            <SheetHeader class="border-b px-5 py-4 text-left">
                <div class="flex items-center justify-between gap-3 pr-8">
                    <SheetTitle>Notifications</SheetTitle>
                    <div class="flex items-center gap-1">
                        <Button variant="ghost" size="icon" type="button" class="size-8" aria-label="Refresh notifications" :disabled="loading || pending" @click="loadInbox()">
                            <RefreshCw class="size-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" type="button" class="size-8" aria-label="Mark all notifications as read" :disabled="loading || pending || !hasUnread" @click="markAllRead">
                            <CheckCheck class="size-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
                <SheetDescription id="inbox-description" class="text-xs">
                    Updates for your connected accounts.
                </SheetDescription>
            </SheetHeader>

            <p v-if="actionError" class="text-destructive border-b px-5 py-3 text-sm" role="alert">{{ actionError }}</p>

            <div v-if="loading" class="space-y-4 px-5 py-6" role="status" aria-label="Loading notifications">
                <div v-for="index in 3" :key="index" class="space-y-2 animate-pulse motion-reduce:animate-none">
                    <div class="bg-muted h-4 w-3/4 rounded" />
                    <div class="bg-muted h-3 w-full rounded" />
                </div>
            </div>
            <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center" role="alert">
                <p class="text-muted-foreground text-sm">{{ error }}</p>
                <Button variant="outline" type="button" @click="loadInbox()">Retry</Button>
            </div>
            <div v-else-if="loaded && notifications.length === 0" class="text-muted-foreground flex flex-1 items-center justify-center px-5 text-center text-sm">
                No notifications yet.
            </div>
            <div v-else class="shift-scrollbar min-h-0 flex-1 overflow-y-auto">
                <div v-for="item in notifications" :key="item.id" class="hover:bg-accent/50 border-b px-5 py-4 transition-colors duration-150 motion-reduce:transition-none">
                    <div class="flex items-start gap-3">
                        <span v-if="!item.read_at" class="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-label="Unread" />
                        <span v-else class="size-2 shrink-0" />
                        <div class="min-w-0 flex-1">
                            <button v-if="item.task_id !== null" type="button" class="text-foreground break-words rounded-sm text-left text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2" :disabled="pending" @click="openTask(item)">
                                {{ item.title }}
                            </button>
                            <p v-else class="text-foreground break-words text-sm font-semibold">{{ item.title }}</p>
                            <p v-if="item.body" class="text-muted-foreground mt-1 break-words text-sm">{{ item.body }}</p>
                            <div class="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 text-xs">
                                <span v-if="item.environment">{{ item.environment }}</span>
                                <span v-if="item.environment" aria-hidden="true">·</span>
                                <time :datetime="item.created_at">{{ formatDate(item.created_at) }}</time>
                            </div>
                        </div>
                        <Button v-if="!item.read_at" variant="ghost" size="icon" type="button" class="size-7 shrink-0" :disabled="pending" :aria-label="`Mark ${item.title} as read`" @click="markRead(item)">
                            <Check class="size-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </div>

            <div v-if="!loading && !error && total > 0" class="border-t px-5 py-3">
                <div class="flex items-center justify-between gap-3 text-xs">
                    <span class="text-muted-foreground">Page {{ currentPage }} of {{ lastPage }}</span>
                    <div class="flex items-center gap-1">
                        <Button variant="ghost" size="icon" type="button" class="size-8" aria-label="Previous notifications page" :disabled="pending || currentPage <= 1" @click="loadInbox(currentPage - 1)"><ChevronLeft class="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="icon" type="button" class="size-8" aria-label="Next notifications page" :disabled="pending || currentPage >= lastPage" @click="loadInbox(currentPage + 1)"><ChevronRight class="size-4" aria-hidden="true" /></Button>
                    </div>
                </div>
            </div>
        </SheetContent>
    </Sheet>
</template>
