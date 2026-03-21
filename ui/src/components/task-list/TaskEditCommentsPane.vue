<script lang="ts" setup>
import axios from '@/axios-config';
import ShiftEditor from '@shared/components/ShiftEditor.vue';
import { renderRichContent } from '@shared/tasks/rich-content';
import { Paperclip } from 'lucide-vue-next';
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuSeparator, ContextMenuTrigger } from 'reka-ui';
import { computed, type ComponentPublicInstance } from 'vue';
import { aiImproveUrl, getTaskListAiImproveEnabled, removeTempUrl, resolveTempUrl, taskListUploadEndpoints } from './editor-config';
import type { ThreadMessage } from './types';

interface Props {
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
    deleteThreadMessage: (message: ThreadMessage) => void | Promise<void>;
    cancelThreadEdit: () => void;
    handleThreadSend: (payload: { html: string; attachments?: any[] }) => void | Promise<void>;
}

const props = defineProps<Props>();
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
            'border-muted-foreground/10 via-background to-background max-h-[70vh] min-h-[28rem] flex-col overflow-hidden rounded-2xl border bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/5 lg:h-full lg:max-h-none lg:min-h-0',
        ]"
    >
        <div class="border-muted-foreground/10 flex items-center justify-between border-b px-4 py-3">
            <div>
                <h3 class="text-foreground text-sm font-semibold">Comments</h3>
            </div>
            <div class="text-muted-foreground text-xs">
                {{ threadMessages.length }} message{{ threadMessages.length === 1 ? '' : 's' }}
            </div>
        </div>

        <div :ref="assignCommentsScrollRef" class="flex-1 space-y-3 overflow-auto px-4 py-4" @load.capture="onCommentsMediaLoadCapture">
            <div v-if="threadLoading" class="text-muted-foreground py-6 text-center text-sm">Loading comments...</div>
            <div v-else-if="threadError" class="text-destructive py-6 text-center text-sm">{{ threadError }}</div>
            <div v-else-if="threadMessages.length === 0" class="text-muted-foreground py-6 text-center text-sm">No comments yet.</div>

            <div v-for="message in threadMessages" :key="message.clientId" :class="message.isYou ? 'justify-end' : 'justify-start'" class="flex">
                <div class="max-w-[86%]">
                    <ContextMenuRoot @update:open="(open) => onCommentContextMenuOpen(message, open)">
                        <ContextMenuTrigger as-child>
                            <div
                                :id="message.id ? `comment-${message.id}` : undefined"
                                :data-testid="message.id ? `comment-bubble-${message.id}` : undefined"
                                :class="
                                    message.isYou
                                        ? 'rounded-br-md bg-sky-600 text-white'
                                        : 'border-muted-foreground/10 bg-background/70 text-foreground rounded-bl-md border'
                                "
                                class="rounded-lg px-3 py-2 text-sm shadow-sm"
                                @dblclick="onMessageDblClick(message, $event)"
                                @touchend="onMessageTouchEnd(message, $event)"
                            >
                                <div v-if="!message.isYou" class="text-foreground/80 mb-1 text-[11px] font-semibold">
                                    {{ message.author }}
                                </div>
                                <div
                                    class="shift-rich text-inherit [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:shadow-sm [&_img.editor-tile]:aspect-square [&_img.editor-tile]:w-[200px] [&_img.editor-tile]:max-w-[200px] [&_img.editor-tile]:object-cover"
                                    @click="onRichContentClick"
                                    v-html="renderRichContent(message.content)"
                                ></div>
                                <div v-if="message.attachments?.length" class="mt-3 flex flex-wrap gap-2">
                                    <a
                                        v-for="attachment in message.attachments"
                                        :key="attachment.id"
                                        :href="attachment.url"
                                        :class="
                                            message.isYou
                                                ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                                                : 'border-muted-foreground/20 bg-muted/20 text-foreground hover:bg-muted/30'
                                        "
                                        class="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-md border px-2 py-1 text-xs transition"
                                        rel="noreferrer"
                                        target="_blank"
                                    >
                                        <Paperclip class="h-3 w-3 shrink-0 opacity-80" />
                                        <span class="min-w-0 truncate">{{ attachment.original_filename }}</span>
                                    </a>
                                </div>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuPortal>
                            <ContextMenuContent class="bg-popover text-popover-foreground z-50 min-w-[10rem] overflow-hidden rounded-md border p-1 shadow-md">
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
                                    @select="startReplyToMessage(message)"
                                >
                                    Reply
                                </ContextMenuItem>
                                <ContextMenuSeparator v-if="!message.isYou && message.id && !message.pending" class="bg-border -mx-1 my-1 h-px" />
                                <ContextMenuItem
                                    v-if="message.isYou && message.id && !message.pending"
                                    class="hover:bg-accent hover:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                                    @select="startThreadEdit(message)"
                                >
                                    Edit
                                </ContextMenuItem>
                                <ContextMenuSeparator v-if="message.isYou && message.id && !message.pending" class="bg-border -mx-1 my-1 h-px" />
                                <ContextMenuItem
                                    v-if="message.isYou && message.id && !message.pending"
                                    class="text-destructive hover:bg-accent hover:text-destructive relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
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
            <ShiftEditor
                :ref="assignThreadComposerRef"
                v-model="threadComposerModel"
                :axios-instance="axios"
                :enable-ai-improve="aiImproveEnabled"
                :ai-context="threadAiContext"
                :ai-improve-url="aiImproveUrl"
                :cancelable="Boolean(threadEditingId)"
                :clear-on-send="false"
                :remove-temp-url="removeTempUrl"
                :resolve-temp-url="resolveTempUrl"
                :temp-identifier="threadTempIdentifier"
                :upload-endpoints="taskListUploadEndpoints"
                data-testid="comments-editor"
                :placeholder="threadEditingId ? 'Edit your comment...' : 'Write a comment...'"
                @cancel="cancelThreadEdit"
                @uploading="setThreadComposerUploading"
                @send="handleThreadSend"
            />
        </div>
    </div>
</template>
