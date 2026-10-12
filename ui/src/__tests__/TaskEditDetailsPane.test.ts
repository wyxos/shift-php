import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import TaskEditDetailsPane from '../components/task-list/TaskEditDetailsPane.vue';
import { stubs } from './task-list/test-helpers';

describe('TaskEditDetailsPane', () => {
    it('labels the editable task description', () => {
        const wrapper = mount(TaskEditDetailsPane, {
            props: {
                editTask: { id: 1, project_id: 42, title: 'Export issue', priority: 'high', status: 'pending' },
                editLoading: false,
                editUploading: false,
                editForm: {
                    title: 'Export issue',
                    priority: 'high',
                    status: 'pending',
                    requirement_status: 'submitted',
                    description: '<p>Check export</p>',
                    collaborators: { internal: [], external: [] },
                },
                isOwner: true,
                canManageCollaborators: false,
                statusOptions: [{ value: 'pending', label: 'Pending' }],
                priorityOptions: [{ value: 'high', label: 'High' }],
                taskAttachments: [],
                editTempIdentifier: 'test',
                editMobilePane: 'details',
                setEditUploading: vi.fn(),
                setEditPriority: vi.fn(),
                setEditStatus: vi.fn(),
                setEditRequirementStatus: vi.fn(),
                setEditDescription: vi.fn(),
                updateEditCollaborators: vi.fn(),
                removeAttachmentFromTask: vi.fn(),
            },
            global: { stubs },
        });

        expect(wrapper.find('[accessible-label="Task description"]').exists()).toBe(true);
        wrapper.unmount();
    });
});
