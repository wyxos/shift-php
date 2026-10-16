import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InboxNotifications from '../components/InboxNotifications.vue';

const get = vi.fn();
const patch = vi.fn();
const push = vi.fn();

vi.mock('@/axios-config', () => ({ default: { get: (...args: unknown[]) => get(...args), patch: (...args: unknown[]) => patch(...args) } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

const notification = {
    id: 'notification-1',
    type: 'reply',
    title: 'Reply on Fixture task',
    body: 'A response is available.',
    task_id: 12,
    thread_id: 3,
    environment: 'Production',
    read_at: null,
    created_at: '2026-10-15T12:00:00Z',
};

function page(items = [notification], current = 1, last = 1) {
    return { notifications: items, unread_count: 1, current_page: current, last_page: last, total: items.length, per_page: 15 };
}

function mountInbox() {
    return mount(InboxNotifications, {
        global: {
            stubs: {
                Sheet: { template: '<div><slot /></div>' },
                SheetTrigger: { template: '<div><slot /></div>' },
                SheetContent: { template: '<section><slot /></section>' },
                SheetHeader: { template: '<header><slot /></header>' },
                SheetTitle: { template: '<h2><slot /></h2>' },
                SheetDescription: { template: '<p><slot /></p>' },
                Button: { emits: ['click'], template: '<button :aria-label="$attrs[\'aria-label\']" :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>' },
            },
        },
    });
}

describe('InboxNotifications', () => {
    beforeEach(() => {
        get.mockReset();
        patch.mockReset();
        push.mockReset();
        get.mockResolvedValue({ data: page() });
        patch.mockResolvedValue({ data: { unread_count: 0 } });
    });

    it('loads only when opened, and reads the current page on explicit refresh', async () => {
        const wrapper = mountInbox();
        expect(get).not.toHaveBeenCalled();
        expect(wrapper.find('[aria-label="Open notifications"]').exists()).toBe(true);

        await wrapper.get('[aria-label="Open notifications"]').trigger('click');
        await flushPromises();
        expect(get).toHaveBeenCalledWith('/shift/api/inbox', expect.objectContaining({ params: { page: 1, per_page: 15 } }));
        expect(wrapper.text()).toContain('Reply on Fixture task');
        expect(wrapper.find('[aria-label="Open notifications, 1 unread"]').exists()).toBe(true);

        await wrapper.get('[aria-label="Refresh notifications"]').trigger('click');
        await flushPromises();
        expect(get).toHaveBeenCalledTimes(2);
    });

    it('shows an error with retry and does not expose malformed responses', async () => {
        get.mockRejectedValueOnce(new Error('offline'));
        get.mockResolvedValueOnce({ data: page() });
        const wrapper = mountInbox();
        await wrapper.get('[aria-label="Open notifications"]').trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('Notifications could not be loaded. Try again.');
        await wrapper.findAll('button').find((button) => button.text() === 'Retry')!.trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('Reply on Fixture task');
    });

    it('marks the selected notification as read before opening its task', async () => {
        const wrapper = mountInbox();
        await wrapper.get('[aria-label="Open notifications"]').trigger('click');
        await flushPromises();
        await wrapper.findAll('button').find((button) => button.text() === 'Reply on Fixture task')!.trigger('click');
        await flushPromises();
        expect(patch).toHaveBeenCalledWith('/shift/api/inbox/notification-1/read');
        expect(push).toHaveBeenCalledWith({ path: '/tasks', query: { task: '12' } });
        expect(wrapper.find('[aria-label="Open notifications"]').exists()).toBe(true);
    });

    it('keeps the notification available when marking it read fails', async () => {
        patch.mockRejectedValueOnce(new Error('offline'));
        const wrapper = mountInbox();
        await wrapper.get('[aria-label="Open notifications"]').trigger('click');
        await flushPromises();
        await wrapper.findAll('button').find((button) => button.text() === 'Reply on Fixture task')!.trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('Could not mark this notification as read. Try again.');
        expect(push).not.toHaveBeenCalled();
    });

    it('pages and marks all currently visible notifications read', async () => {
        get.mockResolvedValueOnce({ data: page([notification], 1, 2) });
        get.mockResolvedValueOnce({ data: page([{ ...notification, id: 'notification-2' }], 2, 2) });
        const wrapper = mountInbox();
        await wrapper.get('[aria-label="Open notifications"]').trigger('click');
        await flushPromises();
        await wrapper.get('[aria-label="Next notifications page"]').trigger('click');
        await flushPromises();
        expect(get).toHaveBeenLastCalledWith('/shift/api/inbox', expect.objectContaining({ params: { page: 2, per_page: 15 } }));
        await wrapper.get('[aria-label="Mark all notifications as read"]').trigger('click');
        await flushPromises();
        expect(patch).toHaveBeenCalledWith('/shift/api/inbox/read-all');
        expect(wrapper.get('[aria-label="Mark all notifications as read"]').attributes('disabled')).toBeDefined();
    });
});
