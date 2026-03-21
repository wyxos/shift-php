import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultTasks,
    getMock,
    makeIndexResponse,
    patchMock,
    putMock,
    resetTaskListTestState,
    stubs,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

describe('TaskList collaborators', () => {
    beforeEach(resetTaskListTestState);

    it('patches collaborator changes through the dedicated collaborator endpoint', async () => {
        vi.useFakeTimers();
        (window as any).shiftConfig = { email: 'viewer@example.com' };

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    project_id: 10,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    environment: 'staging',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'submitter@example.com' },
                    attachments: [],
                    can_manage_collaborators: true,
                    internal_collaborators: [],
                    external_collaborators: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } })
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks));

        patchMock.mockResolvedValueOnce({
            data: {
                id: 1,
                title: 'Auth issue',
                status: 'pending',
                priority: 'high',
                environment: 'staging',
                attachments: [],
                can_manage_collaborators: true,
                internal_collaborators: [],
                external_collaborators: [
                    {
                        id: 'client-2',
                        name: 'Project User',
                        email: 'project@example.com',
                    },
                ],
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.findAll('[data-testid="task-row"]')[0].find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const editCollaboratorStub = wrapper.findAll('[data-testid="stub-task-collaborators"]').at(-1);
        expect(editCollaboratorStub?.attributes('data-read-only')).toBe('false');
        await editCollaboratorStub!.get('[data-testid="stub-add-external-collaborator"]').trigger('click');
        await nextTick();
        await vi.advanceTimersByTimeAsync(700);
        await flushPromises();
        await nextTick();

        expect(putMock).not.toHaveBeenCalled();
        expect(patchMock).toHaveBeenCalledWith('/shift/api/tasks/1/collaborators', {
            environment: 'staging',
            internal_collaborator_ids: [],
            external_collaborators: [
                {
                    id: 'client-2',
                    name: 'Project User',
                    email: 'project@example.com',
                },
            ],
        });

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('renders collaborator management as read-only when the task cannot manage collaborators', async () => {
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'submitter@example.com' },
                    attachments: [],
                    can_manage_collaborators: false,
                    internal_collaborators: [],
                    external_collaborators: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.findAll('[data-testid="task-row"]')[0].find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const editCollaboratorStub = wrapper.findAll('[data-testid="stub-task-collaborators"]').at(-1);
        expect(editCollaboratorStub?.attributes('data-read-only')).toBe('true');

        wrapper.unmount();
    });
});
