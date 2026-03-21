import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultTasks,
    getMock,
    makeIndexResponse,
    postMock,
    resetTaskListTestState,
    stubs,
    toastMocks,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

describe('TaskList comment reply and copy actions', () => {
    beforeEach(resetTaskListTestState);

    it('copies the full text of a non-author comment', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
        });

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
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Hello <strong>team</strong></p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const message = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        await (wrapper.vm as any).copyEntireMessage(message);

        expect(writeTextMock).toHaveBeenCalledWith('Hello team');
        expect(toastMocks.toastSuccessMock).toHaveBeenCalledWith('Message copied');

        wrapper.unmount();
    });

    it('only enables copy selection when the selection belongs to that comment', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
        });

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
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Hello <strong>team</strong></p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const message = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        (wrapper.vm as any).contextMenuMessageId = 10;
        (wrapper.vm as any).contextMenuSelectionText = 'Hello';
        expect((wrapper.vm as any).shouldShowCopySelection(message)).toBe(true);

        await (wrapper.vm as any).copySelectedMessage();
        expect(writeTextMock).toHaveBeenCalledWith('Hello');
        expect(toastMocks.toastSuccessMock).toHaveBeenCalledWith('Selection copied');

        (wrapper.vm as any).contextMenuSelectionText = '';
        expect((wrapper.vm as any).shouldShowCopySelection(message)).toBe(false);
        wrapper.unmount();
    });

    it('replies to a comment by quoting and linking back to the original message', async () => {
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
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Original message</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        postMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 12,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>Sent reply</p>',
                    created_at: '2026-02-09T12:03:00Z',
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

        const message = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        (wrapper.vm as any).startReplyToMessage(message);
        await flushPromises();
        await nextTick();

        const composerHtml = (wrapper.vm as any).threadComposerHtml as string;
        expect(composerHtml).toContain('class="shift-reply"');
        expect(composerHtml).toContain('data-reply-to="10"');

        const commentsEditor = wrapper.get('[data-testid="comments-editor"]');
        await commentsEditor.get('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith(
            '/shift/api/tasks/1/threads',
            expect.objectContaining({
                content: expect.stringContaining('data-reply-to="10"'),
            }),
        );

        wrapper.unmount();
    });

    it('appends multiple replies into the same draft instead of replacing previous content', async () => {
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
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>First message</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                        {
                            id: 13,
                            sender_name: 'Bob',
                            is_current_user: false,
                            content: '<p>Second message</p>',
                            created_at: '2026-02-09T12:02:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const firstMessage = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        const secondMessage = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 13);

        (wrapper.vm as any).startReplyToMessage(firstMessage);
        await flushPromises();
        await nextTick();
        (wrapper.vm as any).threadComposerHtml = `${(wrapper.vm as any).threadComposerHtml}<p>stuff</p>`;

        (wrapper.vm as any).startReplyToMessage(secondMessage);
        await flushPromises();
        await nextTick();

        const composerHtml = (wrapper.vm as any).threadComposerHtml as string;
        const replyMatches = composerHtml.match(/data-reply-to="/g) ?? [];

        expect(replyMatches.length).toBe(2);
        expect(composerHtml).toContain('data-reply-to="10"');
        expect(composerHtml).toContain('data-reply-to="13"');
        expect(composerHtml.indexOf('data-reply-to="10"')).toBeLessThan(composerHtml.indexOf('data-reply-to="13"'));
        expect(composerHtml).toContain('<p>stuff</p>');

        wrapper.unmount();
    });

    it('scrolls and highlights the original comment when clicking a reply quote reference', async () => {
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
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Original message</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                        {
                            id: 11,
                            sender_name: 'Bob',
                            is_current_user: false,
                            content:
                                '<blockquote class="shift-reply" data-reply-to="10"><p>Replying to Alice</p><p>Original message</p></blockquote><p>Follow up</p>',
                            created_at: '2026-02-09T12:03:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const originBubble = wrapper.get('[data-testid="comment-bubble-10"]').element as HTMLElement;
        const originalScrollIntoView = (HTMLElement.prototype as any).scrollIntoView;
        const scrollIntoViewMock = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            value: scrollIntoViewMock,
            configurable: true,
            writable: true,
        });

        const quoteElement = wrapper.get('[data-testid="comment-bubble-11"] blockquote[data-reply-to]').element as HTMLElement;
        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();

        (wrapper.vm as any).onGlobalClickCapture({
            target: quoteElement,
            preventDefault,
            stopPropagation,
        } as unknown as MouseEvent);
        await flushPromises();
        await nextTick();

        expect(scrollIntoViewMock).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
        });
        expect(originBubble.classList.contains('shift-reply-target')).toBe(true);
        expect(preventDefault).toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();

        if (originalScrollIntoView) {
            Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
                value: originalScrollIntoView,
                configurable: true,
                writable: true,
            });
        } else {
            delete (HTMLElement.prototype as any).scrollIntoView;
        }

        wrapper.unmount();
    });

});
