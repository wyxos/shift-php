<script lang="ts" setup>
import type { TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import type { TaskFilterOption } from '@shared/tasks/presentation';
import { ButtonGroup } from '@shift/ui/button-group';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@shift/ui/sheet';
import { computed } from 'vue';
import TaskEditCommentsPane from './TaskEditCommentsPane.vue';
import TaskEditDetailsPane from './TaskEditDetailsPane.vue';
import type { TaskAttachment, TaskDetail, ThreadMessage } from './types';

interface EditFormModel {
    title: string;
    priority: string;
    status: string;
    description: string;
    collaborators: TaskCollaboratorSelection;
}

interface MobilePaneOption {
    value: 'details' | 'comments';
    label: string;
}

interface Props {
    open: boolean;
    editTask: TaskDetail | null;
    editLoading: boolean;
    editError: string | null;
    editUploading: boolean;
    editForm: EditFormModel;
    isOwner: boolean;
    canManageCollaborators: boolean;
    statusOptions: TaskFilterOption[];
    priorityOptions: TaskFilterOption[];
    taskAttachments: TaskAttachment[];
    editTempIdentifier: string;
    editMobilePane: 'details' | 'comments';
    editMobilePaneOptions: readonly MobilePaneOption[];
    threadLoading: boolean;
    threadError: string | null;
    threadMessages: ThreadMessage[];
    threadAiContext: any;
    threadTempIdentifier: string;
    threadComposerHtml: string;
    threadEditingId: number | null;
    threadEditError: string | null;
    setOpen: (value: boolean) => void;
    setEditUploading: (value: boolean) => void;
    setEditTitle: (value: string) => void;
    setEditPriority: (value: string) => void;
    setEditStatus: (value: string) => void;
    setEditDescription: (value: string) => void;
    setEditMobilePane: (value: 'details' | 'comments') => void;
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
    updateEditCollaborators: (value: TaskCollaboratorSelection) => void;
    removeAttachmentFromTask: (attachmentId: number) => void;
}

const props = defineProps<Props>();

const mobilePaneModel = computed({
    get: () => props.editMobilePane,
    set: (value: 'details' | 'comments') => props.setEditMobilePane(value),
});

const mobilePaneOptions = computed<MobilePaneOption[]>(() => [...props.editMobilePaneOptions]);
</script>

<template>
    <Sheet :open="open" @update:open="setOpen">
        <SheetContent class="flex h-full flex-col p-0" side="right" width-preset="task">
            <form class="flex h-full min-h-0 flex-col" data-testid="edit-form">
                <SheetHeader class="sr-only">
                    <SheetTitle>Task</SheetTitle>
                </SheetHeader>

                <div v-if="editTask && !editLoading && !editError" class="border-b px-6 py-4 lg:hidden">
                    <ButtonGroup
                        v-model="mobilePaneModel"
                        aria-label="Edit task section"
                        test-id-prefix="edit-mobile-pane"
                        :options="mobilePaneOptions"
                        :columns="2"
                    />
                </div>

                <div class="flex-1 overflow-y-auto px-6 pt-6 pb-10 lg:min-h-0 lg:overflow-hidden lg:py-10">
                    <div v-if="editLoading" class="text-muted-foreground py-8 text-center">Loading task...</div>
                    <div v-else-if="editError" class="text-destructive py-8 text-center">{{ editError }}</div>

                    <div v-else-if="editTask" class="grid gap-6 lg:h-full lg:min-h-0 lg:grid-cols-2">
                        <TaskEditDetailsPane
                            :edit-task="editTask"
                            :edit-loading="editLoading"
                            :edit-uploading="editUploading"
                            :edit-form="editForm"
                            :is-owner="isOwner"
                            :can-manage-collaborators="canManageCollaborators"
                            :status-options="statusOptions"
                            :priority-options="priorityOptions"
                            :task-attachments="taskAttachments"
                            :edit-temp-identifier="editTempIdentifier"
                            :edit-mobile-pane="editMobilePane"
                            :set-edit-uploading="setEditUploading"
                            :set-edit-title="setEditTitle"
                            :set-edit-priority="setEditPriority"
                            :set-edit-status="setEditStatus"
                            :set-edit-description="setEditDescription"
                            :update-edit-collaborators="updateEditCollaborators"
                            :remove-attachment-from-task="removeAttachmentFromTask"
                        />

                        <TaskEditCommentsPane
                            :edit-mobile-pane="editMobilePane"
                            :thread-loading="threadLoading"
                            :thread-error="threadError"
                            :thread-messages="threadMessages"
                            :thread-ai-context="threadAiContext"
                            :thread-temp-identifier="threadTempIdentifier"
                            :thread-composer-html="threadComposerHtml"
                            :thread-editing-id="threadEditingId"
                            :thread-edit-error="threadEditError"
                            :set-thread-composer-html="setThreadComposerHtml"
                            :set-thread-composer-uploading="setThreadComposerUploading"
                            :set-thread-composer-ref="setThreadComposerRef"
                            :set-comments-scroll-ref="setCommentsScrollRef"
                            :on-rich-content-click="onRichContentClick"
                            :on-comments-media-load-capture="onCommentsMediaLoadCapture"
                            :on-comment-context-menu-open="onCommentContextMenuOpen"
                            :should-show-copy-selection="shouldShowCopySelection"
                            :copy-entire-message="copyEntireMessage"
                            :copy-selected-message="copySelectedMessage"
                            :start-reply-to-message="startReplyToMessage"
                            :start-thread-edit="startThreadEdit"
                            :on-message-dbl-click="onMessageDblClick"
                            :on-message-touch-end="onMessageTouchEnd"
                            :delete-thread-message="deleteThreadMessage"
                            :cancel-thread-edit="cancelThreadEdit"
                            :handle-thread-send="handleThreadSend"
                        />
                    </div>
                </div>
            </form>
        </SheetContent>
    </Sheet>
</template>
