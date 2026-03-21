<script lang="ts" setup>
import axios from '@/axios-config';
import { emptyTaskCollaborators, normalizeTaskCollaborators, type TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { getTaskIdFromQuery } from '@shared/tasks/history';
import { ImageLightbox } from '@shift/ui/image-lightbox';
import { onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';
import TaskCreateSheet from './task-list/TaskCreateSheet.vue';
import TaskDiscardDialog from './task-list/TaskDiscardDialog.vue';
import TaskEditSheet from './task-list/TaskEditSheet.vue';
import TaskListOverviewCard from './task-list/TaskListOverviewCard.vue';
import { getCurrentAppEnvironment } from './task-list/editor-config';
import type { TaskDetail } from './task-list/types';
import { useTaskListComments } from './task-list/useTaskListComments';
import { useTaskListEdit } from './task-list/useTaskListEdit';
import { useTaskListListing } from './task-list/useTaskListListing';

const createOpen = ref(false);
const createLoading = ref(false);
const createError = ref<string | null>(null);
const createUploading = ref(false);
const createTempIdentifier = ref(Date.now().toString());
const createForm = ref({
    title: '',
    priority: 'medium',
    description: '',
    collaborators: emptyTaskCollaborators(),
});

const editOpen = ref(false);
const editTask = ref<TaskDetail | null>(null);
const currentAppEnvironment = getCurrentAppEnvironment();

const {
    tasks,
    totalTasks,
    loading,
    error,
    deleteLoading,
    filtersOpen,
    currentPage,
    lastPage,
    from,
    to,
    highlightedTaskId,
    statusOptions,
    priorityOptions,
    sortByOptions,
    draftStatuses,
    draftPriorities,
    draftSearchTerm,
    draftEnvironmentTerm,
    draftSortBy,
    activeFilterCount,
    setFiltersOpen,
    setDraftStatuses,
    setDraftPriorities,
    setDraftSearchTerm,
    setDraftEnvironmentTerm,
    setDraftSortBy,
    highlightTask,
    fetchTasks,
    resetFilters,
    applyFilters,
    selectAllStatuses,
    selectAllPriorities,
    goToPage,
    deleteTask,
    getTaskEnvironmentLabel,
} = useTaskListListing();

const {
    threadTempIdentifier,
    threadLoading,
    threadError,
    threadMessages,
    threadAiContext,
    threadComposerHtml,
    threadEditingId,
    threadEditError,
    contextMenuMessageId,
    contextMenuSelectionText,
    editMobilePane,
    editMobilePaneOptions,
    lightboxOpen,
    lightboxSrc,
    lightboxAlt,
    setThreadComposerRef,
    setCommentsScrollRef,
    setEditMobilePane,
    setThreadComposerHtml,
    setThreadComposerUploading,
    onCommentContextMenuOpen,
    shouldShowCopySelection,
    copyEntireMessage,
    copySelectedMessage,
    onRichContentClick,
    onGlobalClickCapture,
    onCommentsMediaLoadCapture,
    fetchThreads,
    resetCommentsState,
    handleThreadSend,
    startThreadEdit,
    startReplyToMessage,
    cancelThreadEdit,
    onMessageDblClick,
    onMessageTouchEnd,
    deleteThreadMessage,
} = useTaskListComments({
    editOpen,
    editTask,
});

const {
    editLoading,
    editError,
    editUploading,
    editTempIdentifier,
    editForm,
    confirmCloseOpen,
    isOwner,
    canManageCollaborators,
    taskAttachments,
    setEditUploading,
    setEditTitle,
    setEditPriority,
    setEditStatus,
    setEditDescription,
    discardChangesAndClose,
    onEditOpenChange,
    removeAttachmentFromTask,
    openEdit,
    closeEditNow,
    updateEditCollaborators,
} = useTaskListEdit({
    editOpen,
    editTask,
    tasks,
    fetchTasks,
    fetchThreads,
    resetCommentsState,
    threadEditingId,
    threadComposerHtml,
    currentAppEnvironment,
});

function resetCreateForm() {
    createForm.value = {
        title: '',
        priority: 'medium',
        description: '',
        collaborators: emptyTaskCollaborators(),
    };
    createTempIdentifier.value = Date.now().toString();
    createError.value = null;
    createUploading.value = false;
}

function updateCreateForm(value: { title: string; priority: string; description: string }) {
    createForm.value = {
        ...createForm.value,
        ...value,
    };
}

function updateCreateCollaborators(value: TaskCollaboratorSelection) {
    createForm.value = {
        ...createForm.value,
        collaborators: normalizeTaskCollaborators(value),
    };
}

function setCreateUploading(value: boolean) {
    createUploading.value = value;
}

function openCreate() {
    resetCreateForm();
    createOpen.value = true;
}

function closeCreate() {
    createOpen.value = false;
}

function setCreateOpen(value: boolean) {
    if (value) {
        openCreate();
        return;
    }
    closeCreate();
}

function setConfirmCloseOpen(value: boolean) {
    confirmCloseOpen.value = value;
}

async function createTask() {
    createError.value = null;
    createLoading.value = true;

    try {
        const payload = {
            title: createForm.value.title,
            description: createForm.value.description,
            priority: createForm.value.priority,
            source_url: window.location.origin,
            environment: currentAppEnvironment,
            temp_identifier: createTempIdentifier.value,
            internal_collaborator_ids: createForm.value.collaborators.internal.map((collaborator) => Number(collaborator.id)),
            external_collaborators: createForm.value.collaborators.external.map((collaborator) => ({
                id: collaborator.id,
                name: collaborator.name,
                email: collaborator.email,
            })),
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

defineExpose({
    threadMessages,
    copyEntireMessage,
    contextMenuMessageId,
    contextMenuSelectionText,
    shouldShowCopySelection,
    copySelectedMessage,
    startReplyToMessage,
    threadComposerHtml,
    onGlobalClickCapture,
    closeEditNow,
    editOpen,
});

onMounted(async () => {
    await fetchTasks();
    const deepLinkedTaskId = getTaskIdFromQuery();
    if (deepLinkedTaskId !== null) {
        void openEdit(deepLinkedTaskId, { updateHistory: false });
    }
});
</script>

<template>
    <TaskListOverviewCard
        :tasks="tasks"
        :total-tasks="totalTasks"
        :loading="loading"
        :error="error"
        :delete-loading="deleteLoading"
        :current-page="currentPage"
        :last-page="lastPage"
        :from="from"
        :to="to"
        :highlighted-task-id="highlightedTaskId"
        :filters-open="filtersOpen"
        :active-filter-count="activeFilterCount"
        :draft-statuses="draftStatuses"
        :draft-priorities="draftPriorities"
        :draft-search-term="draftSearchTerm"
        :draft-environment-term="draftEnvironmentTerm"
        :draft-sort-by="draftSortBy"
        :status-options="statusOptions"
        :priority-options="priorityOptions"
        :sort-by-options="sortByOptions"
        :get-task-environment-label="getTaskEnvironmentLabel"
        :set-filters-open="setFiltersOpen"
        :set-draft-statuses="setDraftStatuses"
        :set-draft-priorities="setDraftPriorities"
        :set-draft-search-term="setDraftSearchTerm"
        :set-draft-environment-term="setDraftEnvironmentTerm"
        :set-draft-sort-by="setDraftSortBy"
        :reset-filters="resetFilters"
        :apply-filters="applyFilters"
        :select-all-statuses="selectAllStatuses"
        :select-all-priorities="selectAllPriorities"
        :open-create="openCreate"
        :open-edit="openEdit"
        :delete-task="deleteTask"
        :go-to-page="goToPage"
    />

    <TaskCreateSheet
        :open="createOpen"
        :form="createForm"
        :temp-identifier="createTempIdentifier"
        :loading="createLoading"
        :uploading="createUploading"
        :error="createError"
        :set-open="setCreateOpen"
        :update-form="updateCreateForm"
        :update-collaborators="updateCreateCollaborators"
        :set-uploading="setCreateUploading"
        :submit="createTask"
    />

    <TaskEditSheet
        :open="editOpen"
        :edit-task="editTask"
        :edit-loading="editLoading"
        :edit-error="editError"
        :edit-uploading="editUploading"
        :edit-form="editForm"
        :is-owner="isOwner"
        :can-manage-collaborators="canManageCollaborators"
        :status-options="statusOptions"
        :priority-options="priorityOptions"
        :task-attachments="taskAttachments"
        :edit-temp-identifier="editTempIdentifier"
        :edit-mobile-pane="editMobilePane"
        :edit-mobile-pane-options="editMobilePaneOptions"
        :thread-loading="threadLoading"
        :thread-error="threadError"
        :thread-messages="threadMessages"
        :thread-ai-context="threadAiContext"
        :thread-temp-identifier="threadTempIdentifier"
        :thread-composer-html="threadComposerHtml"
        :thread-editing-id="threadEditingId"
        :thread-edit-error="threadEditError"
        :set-open="onEditOpenChange"
        :set-edit-uploading="setEditUploading"
        :set-edit-title="setEditTitle"
        :set-edit-priority="setEditPriority"
        :set-edit-status="setEditStatus"
        :set-edit-description="setEditDescription"
        :set-edit-mobile-pane="setEditMobilePane"
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
        :update-edit-collaborators="updateEditCollaborators"
        :remove-attachment-from-task="removeAttachmentFromTask"
    />

    <TaskDiscardDialog :open="confirmCloseOpen" :set-open="setConfirmCloseOpen" :discard="discardChangesAndClose" />

    <ImageLightbox v-model:open="lightboxOpen" :alt="lightboxAlt" :src="lightboxSrc" />
</template>
