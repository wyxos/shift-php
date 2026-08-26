import type { CollaboratorOption } from '@shared/tasks/collaborators';
import type { ThreadMessage as SharedThreadMessage } from '@shared/tasks/types';

export type Task = {
    id: number;
    project_id?: number | null;
    project?: {
        id: number;
        name: string;
    } | null;
    title: string;
    type?: 'task' | 'app_error' | string | null;
    type_label?: string | null;
    status: string;
    requirement_status?: string | null;
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
        ready_items?: number;
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
    description?: string;
    created_at?: string;
    submitter?: { name?: string; email?: string };
    attachments?: TaskAttachment[];
    can_manage_collaborators?: boolean;
    internal_collaborators?: CollaboratorOption[];
    external_collaborators?: CollaboratorOption[];
};

export type RequirementCollaboratorPayload = {
    internal_collaborator_ids?: number[];
    include_submitter_as_collaborator?: boolean;
    external_collaborators?: Array<{
        id: string | number;
        name: string;
        email: string;
    }>;
};

export type RequirementPackPayload = RequirementCollaboratorPayload & {
    title: string;
    items: Array<
        RequirementCollaboratorPayload & {
            title: string;
            description: string;
            temp_identifier: string;
        }
    >;
};

export type ThreadMessage = SharedThreadMessage;
