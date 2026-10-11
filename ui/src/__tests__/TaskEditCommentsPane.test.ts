import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import TaskEditCommentsPane from '../components/task-list/TaskEditCommentsPane.vue';
import { stubs } from './task-list/test-helpers';

function props(overrides: Record<string, unknown> = {}) {
    return {
        taskId: 1,
        description: '<p>Check the failed <strong>export</strong> before replying.</p>',
        editMobilePane: 'comments' as const,
        threadLoading: false,
        threadError: null,
        threadMessages: [],
        threadAiContext: null,
        threadTempIdentifier: 'test',
        threadComposerHtml: '<p>Draft reply</p>',
        threadEditingId: null,
        threadEditError: null,
        setThreadComposerHtml: vi.fn(),
        setThreadComposerUploading: vi.fn(),
        setThreadComposerRef: vi.fn(),
        setCommentsScrollRef: vi.fn(),
        onRichContentClick: vi.fn(),
        onCommentsMediaLoadCapture: vi.fn(),
        onCommentContextMenuOpen: vi.fn(),
        shouldShowCopySelection: vi.fn(() => false),
        copyEntireMessage: vi.fn(),
        copySelectedMessage: vi.fn(),
        startReplyToMessage: vi.fn(),
        startThreadEdit: vi.fn(),
        onMessageDblClick: vi.fn(),
        onMessageTouchEnd: vi.fn(),
        deleteThreadMessage: vi.fn(),
        cancelThreadEdit: vi.fn(),
        handleThreadSend: vi.fn(),
        retryThreadSend: vi.fn(),
        ...overrides,
    };
}

describe('TaskEditCommentsPane mobile report context', () => {
    it('keeps a live draft while expanding context and switching panes, then resets expansion for another task', async () => {
        const wrapper = mount(TaskEditCommentsPane, { props: props(), global: { stubs } });
        const pane = wrapper.get('[data-testid="task-edit-comments-pane"]');
        const history = wrapper.get('[aria-label="Comments history"]');
        expect(pane.classes()).toContain('md:rounded-2xl');
        expect(pane.classes()).not.toContain('rounded-2xl');
        expect(history.classes()).toContain('shift-scrollbar');
        expect(history.attributes('tabindex')).toBe('0');
        expect(history.classes()).toContain('md:px-4');
        expect(history.classes()).not.toContain('px-4');
        const report = wrapper.get<HTMLDetailsElement>('[data-testid="task-report-context"]');
        expect(report.classes()).toContain('lg:hidden');
        expect(report.element.open).toBe(false);
        expect(report.text()).toContain('Check the failed export before replying.');

        report.element.open = true;
        expect(wrapper.get('[data-testid="task-report-context-body"]').html()).toContain('<strong>export</strong>');
        expect(wrapper.get<HTMLTextAreaElement>('[data-testid="comments-editor"] [data-testid="stub-editor-input"]').element.value).toBe(
            '<p>Draft reply</p>',
        );

        await wrapper.setProps({ editMobilePane: 'details' });
        await wrapper.setProps({ editMobilePane: 'comments' });
        expect(wrapper.get<HTMLDetailsElement>('[data-testid="task-report-context"]').element.open).toBe(true);
        expect(wrapper.get<HTMLTextAreaElement>('[data-testid="comments-editor"] [data-testid="stub-editor-input"]').element.value).toBe(
            '<p>Draft reply</p>',
        );

        await wrapper.setProps({ taskId: 2, description: '<ul><li>New task context</li></ul>' });
        expect(wrapper.get<HTMLDetailsElement>('[data-testid="task-report-context"]').element.open).toBe(false);
        expect(wrapper.get('[data-testid="task-report-context-body"]').html()).toContain('New task context');

        await wrapper.setProps({ description: '' });
        expect(wrapper.find('[data-testid="task-report-context"]').exists()).toBe(false);
        wrapper.unmount();
    });
});
