import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultTasks,
    getMock,
    makeIndexResponse,
    postMock,
    putMock,
    resetTaskListTestState,
    stubs,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

describe('TaskList comment composer', () => {
    beforeEach(resetTaskListTestState);

    it('posts a new comment and renders it in the list', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetchTasks on mount
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            }) // openEdit task fetch
            .mockResolvedValueOnce({ data: { external: [] } }); // openEdit thread fetch

        postMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 99,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>hello</p>',
                    created_at: '2026-02-09T12:02:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        // click the stub send button (we have multiple editors; use the one marked comments-editor)
        const commentsEditor = wrapper.find('[data-testid="comments-editor"]');
        await commentsEditor.find('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith('/shift/api/tasks/1/threads', expect.objectContaining({ content: '<p>hello</p>' }));
        expect(wrapper.text()).toContain('hello');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('allows the comment owner to edit their comment', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetchTasks on mount
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            }) // openEdit task fetch
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>First</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                        {
                            id: 11,
                            sender_name: 'You',
                            is_current_user: true,
                            content: '<p>Second</p>',
                            created_at: '2026-02-09T12:01:00Z',
                            attachments: [],
                        },
                    ],
                },
            }); // openEdit thread fetch

        putMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 11,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>Edited</p>',
                    created_at: '2026-02-09T12:01:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="comment-bubble-11"]').trigger('dblclick');
        await nextTick();

        const commentsEditor = wrapper.get('[data-testid="comments-editor"]');
        await commentsEditor.get('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(putMock).toHaveBeenCalledWith(
            '/shift/api/tasks/1/threads/11',
            expect.objectContaining({ content: '<p>Second</p>', temp_identifier: expect.any(String) }),
        );
        expect(wrapper.text()).toContain('Edited');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('cancels comment edit on Escape', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetchTasks on mount
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            }) // openEdit task fetch
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 11,
                            sender_name: 'You',
                            is_current_user: true,
                            content: '<p>Second</p>',
                            created_at: '2026-02-09T12:01:00Z',
                            attachments: [],
                        },
                    ],
                },
            }); // openEdit thread fetch

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="comment-bubble-11"]').trigger('dblclick');
        await nextTick();

        const editor = wrapper.get('[data-testid="comments-editor"]');
        expect(editor.attributes('placeholder')).toBe('Edit your comment...');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await nextTick();

        expect(editor.attributes('placeholder')).toBe('Write a comment...');

        wrapper.unmount();
        vi.useRealTimers();
    });

});
