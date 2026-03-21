import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultStatuses,
    defaultTasks,
    getMock,
    makeIndexResponse,
    postMock,
    resetTaskListTestState,
    stubs,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

describe('TaskList create flow', () => {
    beforeEach(resetTaskListTestState);

    it('creates a task with description and sends it to the API', async () => {
        const createdDescription = 'Client repro notes: description should persist.';

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetch on mount
            .mockResolvedValueOnce(
                makeIndexResponse([
                    { id: 99, title: 'Created from UI', status: 'pending', priority: 'medium', environment: 'staging' },
                    ...defaultTasks,
                ]),
            ); // refresh after create

        postMock.mockResolvedValueOnce({
            data: {
                data: {
                    id: 99,
                    title: 'Created from UI',
                    description: createdDescription,
                    status: 'pending',
                    priority: 'medium',
                },
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-create-task"]').trigger('click');
        await nextTick();

        const createPriorityGroup = wrapper.get('[aria-label="Task priority"]');
        expect(createPriorityGroup.classes()).toContain('grid');
        expect(createPriorityGroup.classes()).toContain('grid-cols-3');

        await wrapper.get('[data-testid="create-task-title"]').setValue('Created from UI');
        await wrapper.get('[data-testid="create-task-priority-high"]').trigger('click');
        expect(wrapper.get('[data-testid="create-task-priority-high"]').classes()).toContain('bg-rose-100');
        await wrapper.get('[data-testid="create-description-editor"] [data-testid="stub-editor-input"]').setValue(createdDescription);
        await wrapper.get('[data-testid="create-task-form"]').trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith(
            '/shift/api/tasks',
            expect.objectContaining({
                title: 'Created from UI',
                description: createdDescription,
                priority: 'high',
            }),
        );
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });

        wrapper.unmount();
    });

    it('includes collaborator payload when creating a task', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(defaultTasks));

        postMock.mockResolvedValueOnce({
            data: {
                data: {
                    id: 120,
                    title: 'Created with collaborators',
                    status: 'pending',
                    priority: 'medium',
                },
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-create-task"]').trigger('click');
        await nextTick();

        const createCollaboratorStub = wrapper.findAll('[data-testid="stub-task-collaborators"]')[0];
        await createCollaboratorStub.get('[data-testid="stub-add-internal-collaborator"]').trigger('click');
        await createCollaboratorStub.get('[data-testid="stub-add-external-collaborator"]').trigger('click');
        await wrapper.get('[data-testid="create-task-title"]').setValue('Created with collaborators');
        await wrapper.get('[data-testid="create-task-form"]').trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith(
            '/shift/api/tasks',
            expect.objectContaining({
                title: 'Created with collaborators',
                environment: 'local',
                internal_collaborator_ids: [77],
                external_collaborators: [
                    {
                        id: 'client-2',
                        name: 'Project User',
                        email: 'project@example.com',
                    },
                ],
            }),
        );

        wrapper.unmount();
    });

});
