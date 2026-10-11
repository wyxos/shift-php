import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskList from '../../components/TaskList.vue';
import { defaultTasks, getMock, makeIndexResponse, patchMock, putMock, resetTaskListTestState, stubs } from './test-helpers';

describe('TaskList save status', () => {
    beforeEach(resetTaskListTestState);
    it('keeps a failed task edit and saves it on retry', async () => {
        vi.useFakeTimers();
        (window as any).shiftConfig = { email: 'someone@example.com' };
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } })
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks));
        putMock.mockRejectedValueOnce({ response: { data: { message: 'Connection lost' } } }).mockResolvedValueOnce({
            data: { task: { id: 1, title: 'Updated issue', status: 'pending', priority: 'high', attachments: [] } },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await wrapper.findAll('[data-testid="task-row"]')[0].find('button[data-testid^="task-open-"]').trigger('click');
        await flushPromises();

        await wrapper.get('[data-testid="task-edit-title"]').setValue('Updated issue');
        await vi.advanceTimersByTimeAsync(700);
        await flushPromises();

        expect(wrapper.get<HTMLInputElement>('[data-testid="task-edit-title"]').element.value).toBe('Updated issue');
        expect(wrapper.get('[data-testid="task-save-status"]').text()).toContain('Connection lost');
        expect(wrapper.get('[data-testid="task-save-status"]').text()).not.toContain('Saved');
        await wrapper.get('[data-testid="task-save-retry"]').trigger('click');
        await flushPromises();

        expect(putMock).toHaveBeenCalledTimes(2);
        expect(putMock).toHaveBeenLastCalledWith('/shift/api/tasks/1', expect.objectContaining({ title: 'Updated issue' }));
        expect(wrapper.get('[data-testid="task-save-status"]').attributes('data-state')).toBe('saved');
        wrapper.unmount();
        vi.useRealTimers();
    });

    it('clears a failed save when the edit is restored to its persisted value', async () => {
        vi.useFakeTimers();
        (window as any).shiftConfig = { email: 'someone@example.com' };
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({ data: { id: 1, title: 'Auth issue', priority: 'high', status: 'pending', description: '', submitter: { email: 'someone@example.com' }, attachments: [] } })
            .mockResolvedValueOnce({ data: { external: [] } });
        putMock.mockRejectedValueOnce({ response: { data: { message: 'Connection lost' } } });
        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await wrapper.findAll('[data-testid="task-row"]')[0].find('button[data-testid^="task-open-"]').trigger('click');
        await flushPromises();
        await wrapper.get('[data-testid="task-edit-title"]').setValue('Unsaved title');
        await vi.advanceTimersByTimeAsync(700);
        await flushPromises();
        expect(wrapper.get('[data-testid="task-save-status"]').attributes('data-state')).toBe('error');

        await wrapper.get('[data-testid="task-edit-title"]').setValue('Auth issue');
        await flushPromises();
        expect(wrapper.get('[data-testid="task-save-status"]').attributes('data-state')).toBe('idle');
        expect(wrapper.find('[data-testid="task-save-retry"]').exists()).toBe(false);
        expect(putMock).toHaveBeenCalledTimes(1);
        wrapper.unmount();
        vi.useRealTimers();
    });

    it('keeps new collaborators when a title save returns older collaborators', async () => {
        vi.useFakeTimers();
        (window as any).shiftConfig = { email: 'someone@example.com' };
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({ data: { id: 1, title: 'Auth issue', priority: 'high', status: 'pending', description: '', submitter: { email: 'someone@example.com' }, attachments: [], can_manage_collaborators: true, internal_collaborators: [], external_collaborators: [] } })
            .mockResolvedValueOnce({ data: { external: [] } })
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks));
        putMock.mockResolvedValueOnce({ data: { task: { id: 1, title: 'Updated issue', internal_collaborators: [], external_collaborators: [] } } });
        patchMock.mockResolvedValueOnce({ data: { task: { id: 1, title: 'Updated issue', internal_collaborators: [], external_collaborators: [{ id: 'client-2', name: 'Project User', email: 'project@example.com', environment: 'local' }] } } });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await wrapper.findAll('[data-testid="task-row"]')[0].find('button[data-testid^="task-open-"]').trigger('click');
        await flushPromises();
        await wrapper.get('[data-testid="task-edit-title"]').setValue('Updated issue');
        await wrapper.findAll('[data-testid="stub-task-collaborators"]').at(-1)!.get('[data-testid="stub-add-external-collaborator"]').trigger('click');
        await vi.advanceTimersByTimeAsync(700);
        await flushPromises();

        expect(putMock).toHaveBeenCalledTimes(1);
        expect(patchMock).toHaveBeenCalledTimes(1);
        expect(patchMock).toHaveBeenCalledWith('/shift/api/tasks/1/collaborators', expect.objectContaining({ external_collaborators: [expect.objectContaining({ id: 'client-2' })] }));
        expect(wrapper.findAll('[data-testid="stub-task-collaborators"]').at(-1)!.attributes('data-external-count')).toBe('1');
        expect(wrapper.get('[data-testid="task-save-status"]').attributes('data-state')).toBe('saved');
        await vi.advanceTimersByTimeAsync(700);
        expect(patchMock).toHaveBeenCalledTimes(1);
        wrapper.unmount();
        vi.useRealTimers();
    });
});
