import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import TaskList from '../../components/TaskList.vue';
import { getMock, makeIndexResponse, resetTaskListTestState, seedTasks, stubs } from './test-helpers';

describe('TaskList row metadata', () => {
    beforeEach(resetTaskListTestState);

    it('renders created and updated timestamps in desktop and compact rows', async () => {
        getMock.mockResolvedValueOnce(
            makeIndexResponse([
                {
                    ...seedTasks[0],
                    created_at: '2024-01-01T09:15:00',
                    updated_at: '2024-01-02T11:45:00',
                },
            ]),
        );

        const wrapper = mount(TaskList, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="task-created-at-1"]').text()).toContain('1 Jan 2024');
        expect(wrapper.get('[data-testid="task-created-at-1"]').text()).toContain('09:15');
        expect(wrapper.get('[data-testid="task-updated-at-1"]').text()).toContain('2 Jan 2024');
        expect(wrapper.get('[data-testid="task-updated-at-1"]').text()).toContain('11:45');

        const compactRow = wrapper.get('[data-testid="task-compact-row-1"]');
        expect(compactRow.text()).toContain('Created');
        expect(compactRow.text()).toContain('1 Jan 2024');
        expect(compactRow.text()).toContain('Updated');
        expect(compactRow.text()).toContain('2 Jan 2024');

        wrapper.unmount();
    });

    it('removes redundant type badges while keeping project and task metadata', async () => {
        getMock.mockResolvedValueOnce(
            makeIndexResponse([
                {
                    ...seedTasks[0],
                    id: 10,
                    title: 'Backend error: Checkout failed',
                    type: 'app_error',
                    type_label: 'App error',
                    project: {
                        id: 9,
                        name: 'Requirement Pack QA',
                    },
                },
            ]),
        );

        const wrapper = mount(TaskList, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.find('[data-testid="task-type-badge-10"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="task-project-badge-10"]').text()).toBe('Pack QA');
        expect(wrapper.get('[data-testid="task-status-badge-10"]').text()).toContain('Pending');
        expect(wrapper.get('[data-testid="task-priority-badge-10"]').text()).toContain('High');
        expect(wrapper.get('[data-testid="task-environment-badge-10"]').text()).toContain('Staging');
        expect(wrapper.text()).not.toContain('App error');
        expect(wrapper.text()).not.toContain('Requirement Pack QA');

        wrapper.unmount();
    });
});
