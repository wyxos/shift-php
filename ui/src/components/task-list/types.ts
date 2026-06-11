import type { CollaboratorOption } from '@shared/tasks/collaborators';

export type Task = {
    id: number;
    title: string;
    status: string;
    priority: string;
    phase?: 'task' | 'requirement' | string | null;
    finalized?: boolean | null;
    batch_id?: number | null;
    batch_title?: string | null;
    submitted_title?: string | null;
    submitted_description?: string | null;
    finalized_at?: string | null;
    environment?: string | null;
    can_delete?: boolean;
    batch?: {
        id: number;
        title?: string | null;
        created_at?: string | null;
        total_items: number;
        requirement_items: number;
        finalized_items: number;
    } | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type TaskAttachment = {
    id: number;
    original_filename: string;
    url?: string;
    path?: string;
};

export type TaskDetail = Task & {
    project_id?: number;
    description?: string;
    created_at?: string;
    submitter?: { name?: string; email?: string };
    attachments?: TaskAttachment[];
    can_manage_collaborators?: boolean;
    internal_collaborators?: CollaboratorOption[];
    external_collaborators?: CollaboratorOption[];
};

export type ThreadMessage = {
    clientId: string;
    id?: number;
    author: string;
    time: string;
    content: string;
    isYou?: boolean;
    pending?: boolean;
    failed?: boolean;
    attachments?: TaskAttachment[];
};
