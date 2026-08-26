import { collaboratorKey, emptyTaskCollaborators, type CollaboratorOption, type TaskCollaboratorSelection } from '@shared/tasks/collaborators';

export function currentSubmitterOption(): CollaboratorOption | null {
    const id = window.shiftConfig?.userId;
    const name = window.shiftConfig?.username?.trim();
    const email = window.shiftConfig?.email?.trim();

    if ((typeof id !== 'number' && typeof id !== 'string') || !name || !email) {
        return null;
    }

    return { id, name, email };
}

export function defaultSubmitterCollaborators(): TaskCollaboratorSelection {
    const submitter = currentSubmitterOption();

    if (!submitter) {
        return emptyTaskCollaborators();
    }

    return {
        internal: [],
        external: [submitter],
    };
}

export function includesCurrentSubmitter(collaborators: TaskCollaboratorSelection): boolean {
    const submitter = currentSubmitterOption();

    if (!submitter) {
        return true;
    }

    return collaborators.external.some((collaborator) => collaboratorKey(collaborator.id) === collaboratorKey(submitter.id));
}
