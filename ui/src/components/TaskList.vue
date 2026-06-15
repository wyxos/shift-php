<script lang="ts" setup>
import axios from '@/axios-config';
import { emptyTaskCollaborators, normalizeTaskCollaborators, type TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { getTaskIdFromQuery } from '@shared/tasks/history';
import { ImageLightbox } from '@shift/ui/image-lightbox';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import RequirementPackForm from './task-list/RequirementPackForm.vue';
import TaskCreateSheet from './task-list/TaskCreateSheet.vue';
import TaskDeleteConfirmDialog from './task-list/TaskDeleteConfirmDialog.vue';
import TaskDiscardDialog from './task-list/TaskDiscardDialog.vue';
import TaskEditSheet from './task-list/TaskEditSheet.vue';
import TaskListOverviewCard from './task-list/TaskListOverviewCard.vue';
import TaskSurfaceTabs from './task-list/TaskSurfaceTabs.vue';
import { getCurrentAppEnvironment } from './task-list/editor-config';
import type { TaskDetail } from './task-list/types';
import { useTaskListComments } from './task-list/useTaskListComments';
import { useTaskListEdit } from './task-list/useTaskListEdit';
import { useTaskListListing } from './task-list/useTaskListListing';

type TaskSurface = 'tasks' | 'requirements';
type RequirementCollaboratorPayload = {
    internal_collaborator_ids?: number[];
    external_collaborators?: Array<{
        id: string | number;
        name: string;
        email: string;
    }>;
};
type RequirementPackPayload = RequirementCollaboratorPayload & {
    title: string;
    items: Array<
        RequirementCollaboratorPayload & {
            title: string;
            description: string;
            temp_identifier: string;
        }
    >;
};

const route = useRoute();
const router = useRouter();
const activeSurface = ref<TaskSurface>(surfaceFromPath(route.path));
const isRequirementsMode = computed(() => activeSurface.value === 'requirements');
const listEndpoint = computed(() => (isRequirementsMode.value ? '/shift/api/requirements' : '/shift/api/tasks'));
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
const requirementCreateOpen = ref(false);
const requirementCreateLoading = ref(false);
const requirementCreateError = ref<string | null>(null);
const editOpen = ref(false);
const editTask = ref<TaskDetail | null>(null);
const deleteDialogOpen = ref(false);
const pendingDeleteTask = ref<TaskDetail | null>(null);
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
} = useTaskListListing({
    endpoint: listEndpoint,
});
function surfaceFromPath(path: string): TaskSurface {
    return path === '/requirements' ? 'requirements' : 'tasks';
}
async function setSurface(surface: TaskSurface) {
    if (activeSurface.value === surface) return;
    const path = surface === 'requirements' ? '/requirements' : '/tasks';

    await router.push({
        path,
        query: route.query,
    });

    activeSurface.value = surface;
    currentPage.value = 1;
    await fetchTasks();
}
watch(
    () => route.path,
    async (path) => {
        const nextSurface = surfaceFromPath(path);
        if (activeSurface.value === nextSurface) return;

        activeSurface.value = nextSurface;
        currentPage.value = 1;
        await fetchTasks();
    },
);

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
    setEditRequirementStatus,
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
function openRequirementCreate() {
    requirementCreateError.value = null;
    requirementCreateOpen.value = true;
}
function closeRequirementCreate() {
    requirementCreateOpen.value = false;
    requirementCreateError.value = null;
}
function requestDeleteTask(taskId: number) {
    const task = tasks.value.find((item) => item.id === taskId) ?? null;
    pendingDeleteTask.value = task ? ({ ...task } as TaskDetail) : ({ id: taskId, title: 'this item' } as TaskDetail);
    deleteDialogOpen.value = true;
}
async function confirmDeleteTask() {
    const task = pendingDeleteTask.value;

    if (!task) return;
    deleteDialogOpen.value = false;
    pendingDeleteTask.value = null;
    await deleteTask(task.id);
}
function setConfirmCloseOpen(value: boolean) {
    confirmCloseOpen.value = value;
}
watch(deleteDialogOpen, (open) => {
    if (!open) {
        pendingDeleteTask.value = null;
    }
});
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
async function createRequirementPack(payload: RequirementPackPayload) {
    requirementCreateError.value = null;
    requirementCreateLoading.value = true;
    try {
        const response = await axios.post('/shift/api/requirements/batches', payload);
        const created = response.data?.items ?? response.data?.data ?? [];
        const createdId = Array.isArray(created) && typeof created[0]?.id === 'number' ? created[0].id : null;
        closeRequirementCreate();
        await fetchTasks();
        if (createdId) highlightTask(createdId);
        toast.success('Requirements submitted', { description: 'Your requirements have been submitted.' });
    } catch (e: any) {
        requirementCreateError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error';
    } finally {
        requirementCreateLoading.value = false;
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
    <TaskSurfaceTabs :active-surface="activeSurface" :query="route.query" @set-surface="setSurface" />
    <RequirementPackForm
        v-if="isRequirementsMode && requirementCreateOpen"
        :open="requirementCreateOpen"
        :loading="requirementCreateLoading"
        :error="requirementCreateError"
        @submit="createRequirementPack"
        @cancel="closeRequirementCreate"
    />
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
        :title="isRequirementsMode ? 'Requirements' : 'Tasks'"
        :description="
            isRequirementsMode
                ? 'Submitted requirements stay separate until SHIFT confirms them as active tasks.'
                : 'Default view hides completed and closed tasks.'
        "
        :empty-label="isRequirementsMode ? 'No requirements found' : 'No tasks found'"
        :item-label="isRequirementsMode ? 'requirements' : 'tasks'"
        :status-label="isRequirementsMode ? 'State' : 'Status'"
        :action-label="isRequirementsMode ? 'New Requirements' : 'Create'"
        :action-test-id="isRequirementsMode ? 'open-requirement-pack' : 'open-create-task'"
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
        :open-create="isRequirementsMode ? openRequirementCreate : openCreate"
        :open-edit="openEdit"
        :delete-task="requestDeleteTask"
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
        :set-edit-requirement-status="setEditRequirementStatus"
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
    <TaskDeleteConfirmDialog
        v-model:open="deleteDialogOpen"
        :surface="activeSurface"
        :task-title="pendingDeleteTask?.title"
        @confirm="confirmDeleteTask"
    />
    <ImageLightbox v-model:open="lightboxOpen" :alt="lightboxAlt" :src="lightboxSrc" />
</template>
