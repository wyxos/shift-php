import axios from '@/axios-config';
import ShiftEditor from '@shared/components/ShiftEditor.vue';
import { useTaskThreadState } from '@shared/tasks/useTaskThreadState';
import { ref, watch, type Ref } from 'vue';
import { toast } from 'vue-sonner';
import type { TaskDetail } from './types';

type UseTaskListCommentsOptions = {
    editOpen: Ref<boolean>;
    editTask: Ref<TaskDetail | null>;
};

type ShiftEditorInstance = InstanceType<typeof ShiftEditor>;

export function useTaskListComments({ editOpen, editTask }: UseTaskListCommentsOptions) {
    const editMobilePane = ref<'details' | 'comments'>('details');
    const editMobilePaneOptions = [
        { value: 'details', label: 'Details' },
        { value: 'comments', label: 'Comments' },
    ] as const;

    const thread = useTaskThreadState({
        editOpen,
        editTask,
        getTaskId: (task) => task.id,
        fetchThreads: async (taskId) => {
            const response = await axios.get(`/shift/api/tasks/${taskId}/threads`);
            const payload = response.data?.data ?? response.data;
            return Array.isArray(payload?.external) ? payload.external : [];
        },
        createThread: async (taskId, payload) => {
            const response = await axios.post(`/shift/api/tasks/${taskId}/threads`, {
                content: payload.html,
                temp_identifier: payload.tempIdentifier,
            });
            const data = response.data?.data ?? response.data;
            return data?.thread ?? data;
        },
        updateThread: async (taskId, threadId, payload) => {
            const response = await axios.put(`/shift/api/tasks/${taskId}/threads/${threadId}`, {
                content: payload.html,
                temp_identifier: payload.tempIdentifier,
            });
            const data = response.data?.data ?? response.data;
            return data?.thread ?? data;
        },
        deleteThread: async (taskId, threadId) => {
            await axios.delete(`/shift/api/tasks/${taskId}/threads/${threadId}`);
        },
        optimisticAuthor: () => window.shiftConfig?.username || 'You',
        onCopyMessageSuccess: () => toast.success('Message copied'),
        onCopyMessageError: () => toast.error('Unable to copy message'),
        onCopySelectionSuccess: () => toast.success('Selection copied'),
        onCopySelectionError: () => toast.error('Unable to copy selection'),
        onSendError: (message) => {
            toast.error('Failed to send comment', {
                description: message || 'Unknown error',
            });
        },
        onDeleteError: (message) => {
            toast.error('Failed to delete comment', {
                description: message || 'Unknown error',
            });
        },
    });

    watch(editMobilePane, (pane) => {
        if (!editOpen.value || pane !== 'comments') return;
        thread.scrollCommentsToBottomSoon();
    });

    function setThreadComposerRef(value: ShiftEditorInstance | null) {
        thread.threadComposerRef.value = value;
    }

    function setCommentsScrollRef(value: HTMLElement | null) {
        thread.commentsScrollRef.value = value;
    }

    function setEditMobilePane(value: 'details' | 'comments') {
        editMobilePane.value = value;
    }

    function setThreadComposerHtml(value: string) {
        thread.threadComposerHtml.value = value;
    }

    function setThreadComposerUploading(value: boolean) {
        thread.threadComposerUploading.value = value;
    }

    function resetCommentsState() {
        thread.resetThreadState();
        editMobilePane.value = 'details';
    }

    return {
        ...thread,
        editMobilePane,
        editMobilePaneOptions,
        resetCommentsState,
        setCommentsScrollRef,
        setEditMobilePane,
        setThreadComposerHtml,
        setThreadComposerRef,
        setThreadComposerUploading,
    };
}
