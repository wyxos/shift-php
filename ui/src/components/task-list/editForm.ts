import { emptyTaskCollaborators } from '@shared/tasks/collaborators';

export function createEmptyEditForm() {
    return {
        title: '',
        priority: 'medium',
        status: 'pending',
        requirement_status: 'submitted',
        description: '',
        collaborators: emptyTaskCollaborators(),
    };
}
