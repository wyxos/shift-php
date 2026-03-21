import axios from '@/axios-config';
import {
    collaboratorsEqual,
    emptyTaskCollaborators,
    normalizeTaskCollaborators,
    type TaskCollaboratorSelection,
} from '@shared/tasks/collaborators';
import { getTaskIdFromQuery, syncTaskQuery } from '@shared/tasks/history';
import { getTaskCreatorEmail } from '@shared/tasks/metadata';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { toast } from 'vue-sonner';
import type { Task, TaskDetail } from './types';
type UseTaskListEditOptions = {
    editOpen: Ref<boolean>;
    editTask: Ref<TaskDetail | null>;
    tasks: Ref<Task[]>;
    fetchTasks: () => Promise<void>;
    fetchThreads: (taskId: number) => Promise<void>;
    resetCommentsState: () => void;
    threadEditingId: Ref<number | null>;
    threadComposerHtml: Ref<string>;
    currentAppEnvironment: string;
};
type EditSnapshot = {
    title: string;
    priority: string;
    status: string;
    description: string;
    collaborators: TaskCollaboratorSelection;
};
type OpenEditOptions = {
    updateHistory?: boolean;
};
function getShiftUserEmail(): string | null {
    const email = (window.shiftConfig as any)?.email;
    if (typeof email === 'string' && email.trim()) return email.trim();
    return null;
}
function createEmptyEditForm() {
    return {
        title: '',
        priority: 'medium',
        status: 'pending',
        description: '',
        collaborators: emptyTaskCollaborators(),
    };
}
export function useTaskListEdit({
    editOpen,
    editTask,
    tasks,
    fetchTasks,
    fetchThreads,
    resetCommentsState,
    threadEditingId,
    threadComposerHtml,
    currentAppEnvironment,
}: UseTaskListEditOptions) {
    const editLoading = ref(false);
    const editError = ref<string | null>(null);
    const editUploading = ref(false);
    const editTempIdentifier = ref(Date.now().toString());
    const deletedAttachmentIds = ref<number[]>([]);
    const editForm = ref(createEmptyEditForm());
    const confirmCloseOpen = ref(false);
    const initialEditSnapshot = ref<EditSnapshot | null>(null);
    const taskSaving = ref(false);
    const taskSaveError = ref<string | null>(null);
    const pendingTaskSave = ref(false);
    const autosaveArmed = ref(false);
    const taskSaveToastId = ref<string | number | null>(null);
    const isOwner = computed(() => {
        const currentEmail = getShiftUserEmail();
        const submitterEmail = getTaskCreatorEmail(editTask.value);
        if (!currentEmail || !submitterEmail) return false;
        return currentEmail.toLowerCase() === submitterEmail.toLowerCase();
    });
    const canManageCollaborators = computed(() => Boolean(editTask.value?.can_manage_collaborators));
    const taskAttachments = computed(() => {
        if (!editTask.value?.attachments) return [];
        const removed = new Set(deletedAttachmentIds.value);
        return editTask.value.attachments.filter((attachment) => !removed.has(attachment.id));
    });
    const hasUnsavedTaskChanges = computed(() => {
        if (!editOpen.value) return false;
        if (taskSaving.value) return true;
        return hasPendingTaskChanges();
    });
    const hasUnsavedCommentDraft = computed(() => {
        if (!editOpen.value) return false;
        if (threadEditingId.value) return true;
        return threadComposerHtml.value.trim().length > 0;
    });
    const hasUnsavedChanges = computed(() => hasUnsavedTaskChanges.value || hasUnsavedCommentDraft.value);
    let taskAutosaveTimer: number | null = null;
    watch(
        () => [
            editForm.value.title,
            editForm.value.priority,
            editForm.value.status,
            editForm.value.description,
            JSON.stringify(editForm.value.collaborators),
            deletedAttachmentIds.value.join(','),
        ],
        () => {
            if (!editOpen.value || !autosaveArmed.value) return;
            if (!hasPendingTaskChanges()) return;
            scheduleTaskAutosave();
        },
    );
    onMounted(() => {
        window.addEventListener('popstate', onTaskQueryPopState);
    });
    onBeforeUnmount(() => {
        if (taskAutosaveTimer) window.clearTimeout(taskAutosaveTimer);
        if (taskSaveToastId.value !== null) {
            toast.dismiss(taskSaveToastId.value);
            taskSaveToastId.value = null;
        }
        window.removeEventListener('popstate', onTaskQueryPopState);
    });
    function setEditUploading(value: boolean) {
        editUploading.value = value;
    }
    function setEditTitle(value: string) {
        editForm.value = {
            ...editForm.value,
            title: value,
        };
    }
    function setEditPriority(value: string) {
        editForm.value = {
            ...editForm.value,
            priority: value,
        };
    }
    function setEditStatus(value: string) {
        editForm.value = {
            ...editForm.value,
            status: value,
        };
    }
    function setEditDescription(value: string) {
        editForm.value = {
            ...editForm.value,
            description: value,
        };
    }
    function onTaskQueryPopState() {
        const taskId = getTaskIdFromQuery();
        const currentTaskId = editTask.value?.id ?? null;
        if (taskId === null) {
            if (editOpen.value) closeEditNow(false);
            return;
        }
        if (editOpen.value && currentTaskId === taskId) return;
        void openEdit(taskId, { updateHistory: false });
    }
    function attemptCloseEdit() {
        if (!hasUnsavedChanges.value) {
            closeEditNow();
            return;
        }
        confirmCloseOpen.value = true;
    }
    function discardChangesAndClose() {
        confirmCloseOpen.value = false;
        closeEditNow();
    }
    function onEditOpenChange(open: boolean) {
        if (open) {
            editOpen.value = true;
            return;
        }
        attemptCloseEdit();
    }
    function removeAttachmentFromTask(attachmentId: number) {
        if (!deletedAttachmentIds.value.includes(attachmentId)) {
            deletedAttachmentIds.value = [...deletedAttachmentIds.value, attachmentId];
            scheduleTaskAutosave(true);
        }
    }
    async function openEdit(taskId: number, options: OpenEditOptions = {}) {
        const { updateHistory = true } = options;
        if (taskAutosaveTimer) {
            window.clearTimeout(taskAutosaveTimer);
            taskAutosaveTimer = null;
        }
        editOpen.value = true;
        editLoading.value = true;
        editError.value = null;
        editTask.value = null;
        editUploading.value = false;
        deletedAttachmentIds.value = [];
        taskSaving.value = false;
        taskSaveError.value = null;
        pendingTaskSave.value = false;
        autosaveArmed.value = false;
        resetCommentsState();
        if (updateHistory) {
            syncTaskQuery(taskId, 'push');
        }
        try {
            const response = await axios.get(`/shift/api/tasks/${taskId}`);
            const data = response.data?.data ?? response.data;
            editTask.value = data;
            editForm.value = {
                title: data?.title ?? '',
                priority: data?.priority ?? 'medium',
                status: data?.status ?? 'pending',
                description: data?.description ?? '',
                collaborators: normalizeTaskCollaborators({
                    internal: data?.internal_collaborators ?? [],
                    external: data?.external_collaborators ?? [],
                }),
            };
            editTempIdentifier.value = Date.now().toString();
            initialEditSnapshot.value = currentTaskSnapshot();
            autosaveArmed.value = true;
            void fetchThreads(taskId);
        } catch (e: any) {
            editError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to fetch task';
        } finally {
            editLoading.value = false;
        }
    }
    function closeEditNow(updateHistory = true) {
        if (taskAutosaveTimer) {
            window.clearTimeout(taskAutosaveTimer);
            taskAutosaveTimer = null;
        }
        editOpen.value = false;
        editTask.value = null;
        editError.value = null;
        editUploading.value = false;
        deletedAttachmentIds.value = [];
        editForm.value = createEmptyEditForm();
        initialEditSnapshot.value = null;
        taskSaving.value = false;
        taskSaveError.value = null;
        pendingTaskSave.value = false;
        autosaveArmed.value = false;
        resetCommentsState();
        if (taskSaveToastId.value !== null) {
            toast.dismiss(taskSaveToastId.value);
            taskSaveToastId.value = null;
        }
        if (updateHistory) {
            syncTaskQuery(null, 'push');
        }
    }
    function hasPendingTaskChanges() {
        const snapshot = initialEditSnapshot.value;
        if (!snapshot) return false;
        if (editForm.value.title !== snapshot.title) return true;
        if (editForm.value.priority !== snapshot.priority) return true;
        if (editForm.value.status !== snapshot.status) return true;
        if ((editForm.value.description ?? '') !== (snapshot.description ?? '')) return true;
        if (!collaboratorsEqual(editForm.value.collaborators, snapshot.collaborators)) return true;
        return deletedAttachmentIds.value.length > 0;
    }
    function currentTaskSnapshot(): EditSnapshot {
        return {
            title: editForm.value.title,
            priority: editForm.value.priority,
            status: editForm.value.status,
            description: editForm.value.description,
            collaborators: normalizeTaskCollaborators(editForm.value.collaborators),
        };
    }
    function hasCollaboratorManagementChanges() {
        const snapshot = initialEditSnapshot.value;
        if (!snapshot) return false;
        return !collaboratorsEqual(editForm.value.collaborators, snapshot.collaborators);
    }
    function mergeEditedTask(task: Partial<TaskDetail> | null | undefined) {
        if (!editTask.value || !task) return;
        editTask.value = {
            ...editTask.value,
            ...task,
            attachments: Array.isArray(task.attachments) ? task.attachments : editTask.value.attachments,
        };
        if (task.internal_collaborators || task.external_collaborators) {
            editForm.value.collaborators = normalizeTaskCollaborators({
                internal: Array.isArray(task.internal_collaborators) ? task.internal_collaborators : editForm.value.collaborators.internal,
                external: Array.isArray(task.external_collaborators) ? task.external_collaborators : editForm.value.collaborators.external,
            });
        }
    }
    function updateEditCollaborators(value: TaskCollaboratorSelection) {
        editForm.value.collaborators = normalizeTaskCollaborators(value);
        if (!editOpen.value || !autosaveArmed.value) return;
        if (!hasPendingTaskChanges()) return;
        scheduleTaskAutosave();
    }
    function syncTaskRowFromEditForm(taskId: number) {
        tasks.value = tasks.value.map((task) =>
            task.id === taskId
                ? {
                      ...task,
                      title: editForm.value.title,
                      status: editForm.value.status,
                      priority: editForm.value.priority,
                  }
                : task,
        );
    }
    function scheduleTaskAutosave(immediate = false) {
        if (!autosaveArmed.value || !editTask.value) return;
        if (taskSaving.value) {
            pendingTaskSave.value = true;
            return;
        }
        if (taskAutosaveTimer) {
            window.clearTimeout(taskAutosaveTimer);
            taskAutosaveTimer = null;
        }
        if (immediate) {
            void saveTaskChanges();
            return;
        }
        taskAutosaveTimer = window.setTimeout(() => {
            taskAutosaveTimer = null;
            void saveTaskChanges();
        }, 650);
    }
    function showTaskSavingToast() {
        if (taskSaveToastId.value !== null) return;
        taskSaveToastId.value = toast.loading('Saving task changes...');
    }
    function showTaskSaveResultToast(success: boolean, message?: string) {
        const id = taskSaveToastId.value ?? undefined;
        taskSaveToastId.value = null;
        if (success) {
            toast.success('Task changes saved', { id, duration: 1400 });
            return;
        }
        toast.error('Failed to save task changes', {
            id,
            description: message ?? 'Unknown error',
            duration: 4000,
        });
    }
    async function saveTaskChanges() {
        if (!editTask.value) return;
        if (!hasPendingTaskChanges()) return;
        const snapshot = initialEditSnapshot.value;
        if (!snapshot) return;
        const taskId = editTask.value.id;
        const needsCollaboratorUpdate = canManageCollaborators.value && hasCollaboratorManagementChanges();
        const needsCoreUpdate = isOwner.value
            ? editForm.value.title !== snapshot.title ||
              editForm.value.priority !== snapshot.priority ||
              editForm.value.status !== snapshot.status ||
              (editForm.value.description ?? '') !== (snapshot.description ?? '') ||
              deletedAttachmentIds.value.length > 0
            : editForm.value.status !== snapshot.status;
        if (!needsCoreUpdate && !needsCollaboratorUpdate) return;
        const collaboratorPayload = needsCollaboratorUpdate
            ? {
                  environment: editTask.value.environment ?? currentAppEnvironment,
                  internal_collaborator_ids: editForm.value.collaborators.internal.map((collaborator) => Number(collaborator.id)),
                  external_collaborators: editForm.value.collaborators.external.map((collaborator) => ({
                      id: collaborator.id,
                      name: collaborator.name,
                      email: collaborator.email,
                  })),
              }
            : null;
        taskSaving.value = true;
        taskSaveError.value = null;
        showTaskSavingToast();
        try {
            if (needsCoreUpdate) {
                const payload = isOwner.value
                    ? {
                          title: editForm.value.title,
                          description: editForm.value.description,
                          priority: editForm.value.priority,
                          status: editForm.value.status,
                          temp_identifier: editTempIdentifier.value,
                          deleted_attachment_ids: deletedAttachmentIds.value.length ? deletedAttachmentIds.value : undefined,
                      }
                    : {
                          status: editForm.value.status,
                      };
                const response = await axios.put(`/shift/api/tasks/${taskId}`, payload);
                const data = response.data?.data ?? response.data;
                mergeEditedTask(data?.task ?? data ?? null);
            }
            if (needsCollaboratorUpdate && collaboratorPayload) {
                const response = await axios.patch(`/shift/api/tasks/${taskId}/collaborators`, collaboratorPayload);
                const data = response.data?.data ?? response.data;
                mergeEditedTask(data?.task ?? data ?? null);
            }
            deletedAttachmentIds.value = [];
            initialEditSnapshot.value = currentTaskSnapshot();
            syncTaskRowFromEditForm(taskId);
            await fetchTasks();
        } catch (e: any) {
            taskSaveError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to autosave task';
        } finally {
            taskSaving.value = false;
            if (pendingTaskSave.value) {
                pendingTaskSave.value = false;
                scheduleTaskAutosave(true);
                return;
            }
            showTaskSaveResultToast(!taskSaveError.value, taskSaveError.value ?? undefined);
        }
    }
    return {
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
        attemptCloseEdit,
        discardChangesAndClose,
        onEditOpenChange,
        removeAttachmentFromTask,
        openEdit,
        closeEditNow,
        updateEditCollaborators,
    };
}
