import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { defaultStatuses, defaultTasks, getMock, makeIndexResponse, mountTaskListBare, postMock, resetTaskListTestState } from './test-helpers';

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

        const wrapper = mountTaskListBare();
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-create-task"]').trigger('click');
        await nextTick();

        expect(wrapper.get('[data-testid="create-description-editor"]').find('[data-testid="stub-send"]').exists()).toBe(false);

        const createPriorityGroup = wrapper.get('[aria-label="Task priority"]');
        expect(createPriorityGroup.classes()).toContain('flex');
        expect(createPriorityGroup.classes()).toContain('flex-wrap');

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

        const wrapper = mountTaskListBare();
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-create-task"]').trigger('click');
        await nextTick();

        const createCollaboratorStub = wrapper.findAll('[data-testid="stub-task-collaborators"]')[0];
        await createCollaboratorStub.get('[data-testid="stub-add-internal-collaborator"]').trigger('click');
        await createCollaboratorStub.get('[data-testid="stub-add-external-collaborator"]').trigger('click');
        expect(wrapper.text()).toContain('On create, the submitter and selected collaborators are notified.');
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

    it('hides the email import dropzone when AI is disabled', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks));

        const wrapper = mountTaskListBare();
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-create-task"]').trigger('click');
        await nextTick();

        expect(wrapper.find('[data-testid="task-email-import-dropzone"]').exists()).toBe(false);

        wrapper.unmount();
    });

    it('imports a dropped eml file into the create draft without creating the task when AI is enabled', async () => {
        (window as any).shiftConfig = { appEnvironment: 'local', aiEnabled: true };
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks));

        postMock.mockResolvedValueOnce({
            data: {
                data: {
                    title: 'Imported urgent fixes issue',
                    priority: 'high',
                    description_html: '<p>Customer reports the urgent fixes API fails.</p>',
                    missing_details: [],
                    ai_used: true,
                },
            },
        });

        const wrapper = mountTaskListBare();
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-create-task"]').trigger('click');
        await nextTick();

        const file = new File(['Subject: API question\r\n\r\nBody'], 'issue.eml', { type: 'message/rfc822' });

        await wrapper.get('[data-testid="task-email-import-dropzone"]').trigger('drop', {
            dataTransfer: {
                files: [file],
            },
        });
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledTimes(1);
        expect(postMock).toHaveBeenCalledWith(
            '/shift/api/tasks/email-import',
            expect.any(FormData),
            expect.objectContaining({
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
        );
        expect((wrapper.get('[data-testid="create-task-title"]').element as HTMLInputElement).value).toBe('Imported urgent fixes issue');
        expect(wrapper.get('[data-testid="create-task-priority-high"]').classes()).toContain('bg-rose-100');
        expect(wrapper.get('[data-testid="create-description-editor"] [data-testid="stub-editor-preview"]').text()).toContain(
            'Customer reports the urgent fixes API fails.',
        );
        expect(postMock).not.toHaveBeenCalledWith('/shift/api/tasks', expect.anything());

        wrapper.unmount();
    });
});
