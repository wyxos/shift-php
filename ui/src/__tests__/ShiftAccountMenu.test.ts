import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertDialog } from '@shift/ui/alert-dialog';
import ShiftAccountMenu from '../components/ShiftAccountMenu.vue';

const submit = vi.fn();
const slot = { template: '<div><slot /></div>' };

function mountMenu() {
    return mount(ShiftAccountMenu, {
        global: {
            stubs: {
                Button: { template: '<div><slot /></div>' },
                DropdownMenu: slot, DropdownMenuTrigger: slot, DropdownMenuContent: slot, DropdownMenuLabel: slot, DropdownMenuSeparator: slot,
                DropdownMenuItem: { emits: ['select'], template: '<button data-testid="logout-item" @click="$emit(\'select\')"><slot /></button>' },
                AlertDialog: { props: ['open'], emits: ['update:open'], template: '<section v-if="open" data-testid="confirmation"><slot /></section>' },
                AlertDialogContent: slot, AlertDialogHeader: slot, AlertDialogFooter: slot,
                AlertDialogTitle: { template: '<h2><slot /></h2>' }, AlertDialogDescription: { template: '<p><slot /></p>' },
                AlertDialogAction: { emits: ['click'], template: '<button data-testid="confirm" @click="$emit(\'click\', $event)"><slot /></button>' },
                AlertDialogCancel: { template: '<button>Cancel</button>' },
            },
        },
    });
}

describe('ShiftAccountMenu', () => {
    beforeEach(() => {
        submit.mockReset();
        vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(submit);
        window.shiftConfig = {
            appName: 'Consumer', baseUrl: window.location.origin, loginRoute: '/login',
            username: 'Sample User', email: '1@example.test', appEnvironment: 'sandbox', aiEnabled: false,
            logoutRoute: '/logout', logoutMethod: 'POST', csrfToken: 'fixture-csrf',
        };
    });

    afterEach(() => vi.restoreAllMocks());

    it('requires explicit confirmation and never logs out when confirmation is cancelled', async () => {
        const wrapper = mountMenu();
        expect(wrapper.find('[data-testid="confirmation"]').exists()).toBe(false);
        await wrapper.get('[data-testid="logout-item"]').trigger('click');
        expect(wrapper.get('h2').text()).toBe('Sign out of Consumer?');
        expect(wrapper.get('[data-testid="confirmation"]').text()).toContain('in sandbox');
        expect(submit).not.toHaveBeenCalled();

        wrapper.getComponent(AlertDialog).vm.$emit('update:open', false);
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[data-testid="confirmation"]').exists()).toBe(false);
        expect(submit).not.toHaveBeenCalled();
    });

    it('submits the consuming app form with CSRF protection only after confirmation, once', async () => {
        const wrapper = mountMenu();
        await wrapper.get('[data-testid="logout-item"]').trigger('click');
        await wrapper.get('[data-testid="confirm"]').trigger('click');
        await wrapper.get('[data-testid="confirm"]').trigger('click');
        expect(submit).toHaveBeenCalledOnce();
        expect(wrapper.get('form').attributes()).toMatchObject({ action: new URL('/logout', window.location.href).href, method: 'post' });
        expect(wrapper.get('input[name="_token"]').element).toHaveProperty('value', 'fixture-csrf');
        expect(wrapper.find('input[name="_method"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="confirm"]').attributes('disabled')).toBeDefined();
    });

    it.each(['DELETE', 'PUT', 'PATCH'] as const)('preserves the consuming app %s route using method spoofing', async (method) => {
        window.shiftConfig.logoutMethod = method;
        const wrapper = mountMenu();
        expect(wrapper.get('input[name="_method"]').element).toHaveProperty('value', method);
        await wrapper.get('[data-testid="logout-item"]').trigger('click');
        expect(submit).not.toHaveBeenCalled();
        await wrapper.get('[data-testid="confirm"]').trigger('click');
        expect(submit).toHaveBeenCalledOnce();
    });

    it.each([
        { logoutRoute: null },
        { logoutRoute: 'https://other.example.test/logout' },
        { logoutRoute: window.location.origin.replace(/:\d+$/, '') + ':9999/logout' },
        { logoutRoute: 'javascript:alert(1)' },
        { csrfToken: null },
        { logoutMethod: null },
    ])('leaves sign-out to the consuming app when the runtime has no safe action: %j', (overrides) => {
        Object.assign(window.shiftConfig, overrides);
        const wrapper = mountMenu();
        expect(wrapper.find('[data-testid="logout-item"]').exists()).toBe(false);
        expect(wrapper.find('form').exists()).toBe(false);
        expect(wrapper.text()).toContain('Return to Consumer to sign out.');
        expect(submit).not.toHaveBeenCalled();
    });
});
