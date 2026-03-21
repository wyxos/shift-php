import { getRuntimeAppEnvironment } from '../../lib/runtime-config';

export const taskListUploadEndpoints = {
    init: '/shift/api/attachments/upload-init',
    status: '/shift/api/attachments/upload-status',
    chunk: '/shift/api/attachments/upload-chunk',
    complete: '/shift/api/attachments/upload-complete',
};

export const removeTempUrl = '/shift/api/attachments/remove-temp';
export const aiImproveUrl = '/shift/api/ai/improve';

export function getTaskListAiImproveEnabled() {
    return Boolean(window.shiftConfig?.aiEnabled);
}

export function getCurrentAppEnvironment() {
    return getRuntimeAppEnvironment();
}

export function resolveTempUrl(data: any): string {
    if (data && data.url) return data.url as string;
    if (data && data.path) {
        const match = String(data.path).match(/^temp_attachments\/([^/]+)\/(.+)$/);
        if (match) {
            return `/shift/api/attachments/temp/${match[1]}/${match[2]}`;
        }
    }
    return '';
}
