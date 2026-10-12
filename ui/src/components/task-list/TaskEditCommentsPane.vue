<script lang="ts" setup>
import axios from '@/axios-config';
import ShiftEditor from '@shared/components/ShiftEditor.vue';
import TaskCommentMenu from '@shared/components/tasks/TaskCommentMenu.vue';
import TaskReportContext from '@shared/components/tasks/TaskReportContext.vue';
import { imageTiles } from '@shared/tasks/image-tile';
import { renderRichContent } from '@shared/tasks/rich-content';
import { LoaderCircle, Paperclip, RotateCcw } from 'lucide-vue-next';
import { ContextMenuItem, ContextMenuSeparator } from 'reka-ui';
import { computed, type ComponentPublicInstance } from 'vue';
import { aiImproveUrl, getTaskListAiImproveEnabled, removeTempUrl, resolveTempUrl, taskListUploadEndpoints } from './editor-config';
import type { ThreadMessage } from './types';

interface Props {
    isRequirement?: boolean;
    description?: string | null;
    taskId?: number | null;
    editMobilePane: 'details' | 'comments';
    threadLoading: boolean;
    threadError: string | null;
    threadMessages: ThreadMessage[];
    threadAiContext: any;
    threadTempIdentifier: string;
    threadComposerHtml: string;
    threadEditingId: number | null;
    threadEditError: string | null;
    setThreadComposerHtml: (value: string) => void;
    setThreadComposerUploading: (value: boolean) => void;
    setThreadComposerRef: (value: any) => void;
    setCommentsScrollRef: (value: HTMLElement | null) => void;
    onRichContentClick: (event: MouseEvent) => void;
    onCommentsMediaLoadCapture: (event: Event) => void;
    onCommentContextMenuOpen: (message: ThreadMessage, open: boolean) => void;
    shouldShowCopySelection: (message: ThreadMessage) => boolean;
    copyEntireMessage: (message: ThreadMessage) => void | Promise<void>;
    copySelectedMessage: () => void | Promise<void>;
    startReplyToMessage: (message: ThreadMessage) => void;
    startThreadEdit: (message: ThreadMessage) => void;
    onMessageDblClick: (message: ThreadMessage, event: MouseEvent) => void;
    onMessageTouchEnd: (message: ThreadMessage, event: TouchEvent) => void;
    deleteThreadMessage: (message: ThreadMessage) => boolean | Promise<boolean>;
    cancelThreadEdit: () => void;
    handleThreadSend: (payload: { html: string; attachments?: any[] }) => void | Promise<void>;
    retryThreadSend: (message: ThreadMessage) => void;
}

const props = withDefaults(defineProps<Props>(), {
    isRequirement: false,
});
const vImageTiles = imageTiles;
const aiImproveEnabled = getTaskListAiImproveEnabled();

const threadComposerModel = computed({
    get: () => props.threadComposerHtml,
    set: (value: string) => props.setThreadComposerHtml(value),
});

function assignThreadComposerRef(value: Element | ComponentPublicInstance | null) {
    props.setThreadComposerRef(value as unknown as InstanceType<typeof ShiftEditor> | null);
}

function assignCommentsScrollRef(value: Element | ComponentPublicInstance | null) {
    props.setCommentsScrollRef(value instanceof HTMLElement ? value : null);
}
</script>

<template>
    <div
        :class="[
            editMobilePane === 'details' ? 'hidden lg:flex' : 'flex',
            'task-comments-pane shift-scrollbar md:border-muted-foreground/10 md:via-background md:to-background h-full max-h-none min-h-0 min-w-0 flex-col overflow-hidden md:rounded-2xl md:border md:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] md:from-slate-900/5',
        ]"
        data-testid="task-edit-comments-pane"
    >
        <div class="border-muted-foreground/10 flex shrink-0 items-center justify-between py-3 md:border-b md:px-4">
            <div>
                <h3 class="text-foreground text-sm font-semibold">{{ isRequirement ? 'Clarifications' : 'Comments' }}</h3>
            </div>
            <div class="text-muted-foreground text-xs">{{ threadMessages.length }} message{{ threadMessages.length === 1 ? '' : 's' }}</div>
        </div>

        <div
            :ref="assignCommentsScrollRef"
            class="task-comments-history shift-scrollbar focus-visible:ring-ring min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset md:px-4"
            role="region"
            aria-label="Comments history"
            tabindex="0"
            @load.capture="onCommentsMediaLoadCapture"
        >
            <TaskReportContext :key="taskId ?? 'no-task'" :description="description" />
            <div v-if="threadLoading && threadMessages.length === 0" class="text-muted-foreground py-6 text-center text-sm">Loading comments...</div>
            <div v-else-if="threadError && threadMessages.length === 0" class="text-destructive py-6 text-center text-sm">{{ threadError }}</div>
            <div v-else-if="threadMessages.length === 0" class="text-muted-foreground py-6 text-center text-sm">No comments yet.</div>

            <div v-for="message in threadMessages" :key="message.clientId" :class="message.isYou ? 'justify-end' : 'justify-start'" class="flex">
                <div class="max-w-[min(86%,calc(100%_-_3rem))] min-w-0">
                    <TaskCommentMenu
                        :label="`Actions for comment by ${message.author}`"
                        :trigger-id="`comment-actions-${message.id}`"
                        :own="message.isYou"
                        :disabled="message.pending || message.failed"
                        @update:open="(open) => onCommentContextMenuOpen(message, open)"
                    >
                        <div
                            :id="message.id ? `comment-${message.id}` : undefined"
                            :data-testid="message.id ? `comment-bubble-${message.id}` : undefined"
                            :class="
                                message.isYou
                                    ? 'task-comment-own rounded-br-md'
                                    : 'border-muted-foreground/10 bg-background/70 text-foreground rounded-bl-md border'
                            "
                            class="rounded-lg px-3 py-2 text-sm shadow-sm"
                            @dblclick="onMessageDblClick(message, $event)"
                            @touchend="onMessageTouchEnd(message, $event)"
                        >
                            <div v-if="!message.isYou" class="text-foreground/80 mb-1 text-xs font-semibold">
                                {{ message.author }}
                            </div>
                            <div
                                v-image-tiles
                                class="shift-rich text-inherit [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm [&_img.editor-tile]:aspect-square [&_img.editor-tile]:w-[200px] [&_img.editor-tile]:max-w-[200px] [&_img.editor-tile]:object-contain"
                                @click="onRichContentClick"
                                v-html="renderRichContent(message.content)"
                            ></div>
                            <div v-if="message.attachments?.length" class="mt-3 flex flex-wrap gap-2">
                                <component
                                    :is="message.pending || message.failed ? 'span' : 'a'"
                                    v-for="attachment in message.attachments"
                                    :key="attachment.id"
                                    :href="message.pending || message.failed ? undefined : attachment.url"
                                    :class="
                                        message.isYou
                                            ? 'border-white/20 bg-black/10 text-white hover:bg-black/20'
                                            : 'border-muted-foreground/20 bg-muted/20 text-foreground hover:bg-muted/30'
                                    "
                                    class="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-md border px-2 py-1 text-xs transition"
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    <Paperclip class="h-3 w-3 shrink-0 opacity-80" />
                                    <span class="min-w-0 truncate">{{ attachment.original_filename }}</span>
                                </component>
                            </div>
                        </div>
                        <template #items>
                            <ContextMenuItem
                                v-if="!message.isYou"
                                class="hover:bg-accent hover:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                                @select="copyEntireMessage(message)"
                            >
                                Copy
                            </ContextMenuItem>
                            <ContextMenuItem
                                v-if="shouldShowCopySelection(message)"
                                class="hover:bg-accent hover:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                                @select="copySelectedMessage"
                            >
                                Copy selection
                            </ContextMenuItem>
                            <ContextMenuItem
                                v-if="!message.isYou && message.id && !message.pending"
                                class="hover:bg-accent hover:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                                data-comment-focus-action="editor"
                                @select="startReplyToMessage(message)"
                            >
                                Reply
                            </ContextMenuItem>
                            <ContextMenuSeparator v-if="!message.isYou && message.id && !message.pending" class="bg-border -mx-1 my-1 h-px" />
                            <ContextMenuItem
                                v-if="message.isYou && message.id && !message.pending"
                                class="hover:bg-accent hover:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                                data-comment-focus-action="editor"
                                @select="startThreadEdit(message)"
                            >
                                Edit
                            </ContextMenuItem>
                            <ContextMenuSeparator v-if="message.isYou && message.id && !message.pending" class="bg-border -mx-1 my-1 h-px" />
                            <ContextMenuItem
                                v-if="message.isYou && message.id && !message.pending"
                                class="text-destructive hover:bg-accent hover:text-destructive relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                                data-comment-focus-action="dialog"
                                @select="deleteThreadMessage(message)"
                            >
                                Delete
                            </ContextMenuItem>
                        </template>
                    </TaskCommentMenu>

                    <div
                        :class="message.isYou ? 'justify-end' : 'justify-start'"
                        class="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs"
                        role="status"
                    >
                        <LoaderCircle v-if="message.pending" class="size-3 animate-spin" aria-hidden="true" />
                        {{ message.time }}
                        <button
                            v-if="message.failed"
                            type="button"
                            class="text-foreground hover:bg-accent inline-flex items-center gap-1 rounded px-1.5 py-0.5 underline-offset-2 hover:underline"
                            :data-testid="`retry-comment-${message.clientId}`"
                            @click="retryThreadSend(message)"
                        >
                            <RotateCcw class="size-3" aria-hidden="true" /> Retry
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="border-muted-foreground/10 bg-background/80 shrink-0 py-3 backdrop-blur md:border-t md:px-4">
            <div v-if="threadEditError" class="text-destructive mb-2 text-xs">{{ threadEditError }}</div>
            <p v-if="!threadEditingId" class="text-muted-foreground mb-2 text-xs" data-testid="comment-audience-hint">
                Visible to task collaborators, including external collaborators. Other collaborators may be notified.
            </p>
            <ShiftEditor
                :ref="assignThreadComposerRef"
                v-model="threadComposerModel"
                :touch-friendly="true"
                :axios-instance="axios"
                :enable-ai-improve="aiImproveEnabled"
                :ai-context="threadAiContext"
                :ai-improve-url="aiImproveUrl"
                :accessible-label="threadEditingId ? 'Edit comment' : 'Write a comment'"
                :cancelable="Boolean(threadEditingId)"
                :clear-on-send="false"
                :remove-temp-url="removeTempUrl"
                :resolve-temp-url="resolveTempUrl"
                :temp-identifier="threadTempIdentifier"
                :upload-endpoints="taskListUploadEndpoints"
                data-testid="comments-editor"
                class="task-comment-composer"
                :placeholder="threadEditingId ? 'Edit your comment...' : 'Write a comment...'"
                @cancel="cancelThreadEdit"
                @uploading="setThreadComposerUploading"
                @send="handleThreadSend"
            />
        </div>
    </div>
</template>
