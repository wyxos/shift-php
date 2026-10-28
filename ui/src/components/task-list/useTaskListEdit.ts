import axios from '@/axios-config';
import { createUploadIdentifier } from '@shared/lib/uploadIdentifier';
import { collaboratorsEqual, normalizeTaskCollaborators, type TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { getTaskIdFromQuery, syncTaskQuery } from '@shared/tasks/history';
import { getTaskCreatorEmail } from '@shared/tasks/metadata';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { toast } from 'vue-sonner';
import { createEmptyEditForm } from './editForm';
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
    requirement_status: string;
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
    const editTempIdentifier = ref(createUploadIdentifier());
    const deletedAttachmentIds = ref<number[]>([]);
    const editForm = ref(createEmptyEditForm());
    const confirmCloseOpen = ref(false);
    const initialEditSnapshot = ref<EditSnapshot | null>(null);
    const taskSaving = ref(false);
    const taskSaveError = ref<string | null>(null);
    const taskSaved = ref(false);
    const pendingTaskSave = ref(false);
    let editSessionVersion = 0;
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
    const taskSaveState = computed<'idle' | 'pending' | 'saving' | 'saved' | 'error'>(() => {
        if (taskSaving.value) return 'saving';
        if (taskSaveError.value && hasPendingTaskChanges()) return 'error';
        if (hasPendingTaskChanges()) return 'pending';
        return taskSaved.value ? 'saved' : 'idle';
    });
    let taskAutosaveTimer: number | null = null;
    watch(
        () => [
            editForm.value.title,
            editForm.value.priority,
            editForm.value.status,
            editForm.value.requirement_status,
            editForm.value.description,
            JSON.stringify(editForm.value.collaborators),
            deletedAttachmentIds.value.join(','),
        ],
        () => {
            if (!editOpen.value || !autosaveArmed.value) return;
            if (!hasPendingTaskChanges()) {
                taskSaveError.value = null;
                return;
            }
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
    function setEditRequirementStatus(value: string) {
        editForm.value = {
            ...editForm.value,
            requirement_status: value,
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
        editSessionVersion += 1;
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
        taskSaved.value = false;
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
                requirement_status: data?.requirement_status ?? 'submitted',
                description: data?.description ?? '',
                collaborators: normalizeTaskCollaborators({
                    internal: data?.internal_collaborators ?? [],
                    external: data?.external_collaborators ?? [],
                }),
            };
            editTempIdentifier.value = createUploadIdentifier();
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
        editSessionVersion += 1;
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
        taskSaved.value = false;
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
        if (editForm.value.requirement_status !== snapshot.requirement_status) return true;
        if ((editForm.value.description ?? '') !== (snapshot.description ?? '')) return true;
        if (!collaboratorsEqual(editForm.value.collaborators, snapshot.collaborators)) return true;
        return deletedAttachmentIds.value.length > 0;
    }
    function currentTaskSnapshot(): EditSnapshot {
        return {
            title: editForm.value.title,
            priority: editForm.value.priority,
            status: editForm.value.status,
            requirement_status: editForm.value.requirement_status,
            description: editForm.value.description,
            collaborators: normalizeTaskCollaborators(editForm.value.collaborators),
        };
    }
    function hasCollaboratorManagementChanges() {
        const snapshot = initialEditSnapshot.value;
        if (!snapshot) return false;
        return !collaboratorsEqual(editForm.value.collaborators, snapshot.collaborators);
    }
    function mergeEditedTask(task: Partial<TaskDetail> | null | undefined, submittedSnapshot: EditSnapshot, mergeCollaborators = false) {
        if (!editTask.value || !task) return;
        const taskUpdates = { ...task };
        if (!mergeCollaborators) {
            delete taskUpdates.internal_collaborators;
            delete taskUpdates.external_collaborators;
            delete taskUpdates.environment;
        }
        editTask.value = {
            ...editTask.value,
            ...taskUpdates,
            attachments: Array.isArray(task.attachments) ? task.attachments : editTask.value.attachments,
        };
        if (typeof task.requirement_status === 'string' && editForm.value.requirement_status === submittedSnapshot.requirement_status) {
            editForm.value.requirement_status = task.requirement_status;
        }
        if (
            mergeCollaborators &&
            (task.internal_collaborators || task.external_collaborators) &&
            collaboratorsEqual(editForm.value.collaborators, submittedSnapshot.collaborators)
        ) {
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
    function syncTaskRowFromEditForm(taskId: number, saved: EditSnapshot) {
        tasks.value = tasks.value.map((task) =>
            task.id === taskId
                ? {
                      ...task,
                      title: saved.title,
                      status: saved.status,
                      requirement_status: saved.requirement_status,
                      priority: saved.priority,
                  }
                : task,
        );
    }
    function scheduleTaskAutosave(immediate = false) {
        if (!autosaveArmed.value || !editTask.value) return;
        taskSaved.value = false;
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
        if (taskSaving.value) {
            pendingTaskSave.value = true;
            return;
        }
        if (!hasPendingTaskChanges()) return;
        const snapshot = initialEditSnapshot.value;
        if (!snapshot) return;
        const taskId = editTask.value.id;
        const sessionVersion = editSessionVersion;
        const isRequirementPhase = editTask.value.phase === 'requirement';
        const needsCollaboratorUpdate = canManageCollaborators.value && hasCollaboratorManagementChanges();
        const needsCoreUpdate = isOwner.value
            ? editForm.value.title !== snapshot.title ||
              editForm.value.priority !== snapshot.priority ||
              (!isRequirementPhase && editForm.value.status !== snapshot.status) ||
              (isRequirementPhase && editForm.value.requirement_status !== snapshot.requirement_status) ||
              (editForm.value.description ?? '') !== (snapshot.description ?? '') ||
              deletedAttachmentIds.value.length > 0
            : isRequirementPhase
              ? editForm.value.requirement_status !== snapshot.requirement_status
              : editForm.value.status !== snapshot.status;
        if (!needsCoreUpdate && !needsCollaboratorUpdate) return;
        const collaboratorPayload = needsCollaboratorUpdate
            ? {
                  internal_collaborator_ids: editForm.value.collaborators.internal.map((collaborator) => Number(collaborator.id)),
                  external_collaborators: editForm.value.collaborators.external.map((collaborator) => ({
                      id: collaborator.id,
                      name: collaborator.name,
                      email: collaborator.email,
                      environment: collaborator.environment ?? currentAppEnvironment,
                  })),
              }
            : null;
        const submittedSnapshot = currentTaskSnapshot();
        const submittedAttachmentIds = [...deletedAttachmentIds.value];
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
                          ...(isRequirementPhase ? { requirement_status: editForm.value.requirement_status } : { status: editForm.value.status }),
                          temp_identifier: editTempIdentifier.value,
                          deleted_attachment_ids: deletedAttachmentIds.value.length ? deletedAttachmentIds.value : undefined,
                      }
                    : isRequirementPhase
                      ? {
                            requirement_status: editForm.value.requirement_status,
                        }
                      : {
                            status: editForm.value.status,
                        };
                const response = await axios.put(`/shift/api/tasks/${taskId}`, payload);
                if (sessionVersion !== editSessionVersion) return;
                const data = response.data?.data ?? response.data;
                mergeEditedTask(data?.task ?? data ?? null, submittedSnapshot);
            }
            if (needsCollaboratorUpdate && collaboratorPayload) {
                const response = await axios.patch(`/shift/api/tasks/${taskId}/collaborators`, collaboratorPayload);
                if (sessionVersion !== editSessionVersion) return;
                const data = response.data?.data ?? response.data;
                mergeEditedTask(data?.task ?? data ?? null, submittedSnapshot, true);
            }
            deletedAttachmentIds.value = deletedAttachmentIds.value.filter((id) => !submittedAttachmentIds.includes(id));
            initialEditSnapshot.value = submittedSnapshot;
            syncTaskRowFromEditForm(taskId, submittedSnapshot);
            await fetchTasks();
            if (sessionVersion !== editSessionVersion) return;
            taskSaved.value = !hasPendingTaskChanges();
        } catch (e: any) {
            if (sessionVersion !== editSessionVersion) return;
            taskSaveError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to autosave task';
            taskSaved.value = false;
        } finally {
            if (sessionVersion !== editSessionVersion) return;
            taskSaving.value = false;
            if (!taskSaveError.value && hasPendingTaskChanges()) {
                pendingTaskSave.value = false;
                scheduleTaskAutosave(true);
                return;
            }
            pendingTaskSave.value = false;
            showTaskSaveResultToast(!taskSaveError.value, taskSaveError.value ?? undefined);
        }
    }
    function retryTaskSave() {
        if (taskSaving.value || !hasPendingTaskChanges()) return;
        scheduleTaskAutosave(true);
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
        taskSaveState,
        taskSaveError,
        retryTaskSave,
        setEditUploading,
        setEditTitle,
        setEditPriority,
        setEditStatus,
        setEditRequirementStatus,
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
