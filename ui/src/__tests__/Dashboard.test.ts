import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import Dashboard from '../components/Dashboard.vue';

const getMock = vi.fn();

function passthroughComponent(): any {
    return {
        render(this: any) {
            return h('div', {}, this.$slots.default?.());
        },
    };
}

vi.mock('@/axios-config', () => ({
    default: {
        get: (...args: any[]) => getMock(...args),
    },
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

vi.mock('@shift/ui/chart', () => ({
    ChartContainer: passthroughComponent(),
    ChartTooltip: passthroughComponent(),
    ChartCrosshair: passthroughComponent(),
    ChartTooltipContent: passthroughComponent(),
    componentToString: vi.fn(() => ''),
}));

vi.mock('@unovis/vue', () => ({
    VisAxis: passthroughComponent(),
    VisDonut: passthroughComponent(),
    VisGroupedBar: passthroughComponent(),
    VisSingleContainer: passthroughComponent(),
    VisXYContainer: passthroughComponent(),
}));

vi.mock('@unovis/ts', () => ({
    Donut: {
        selectors: {
            segment: 'segment',
        },
    },
}));

describe('Dashboard.vue', () => {
    it('fetches dashboard metrics and renders key sections', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                metrics: {
                    total: 12,
                    open: 7,
                    completed: 4,
                    awaiting_feedback: 2,
                    high_priority_open: 3,
                    mine_total: 5,
                    mine_open: 2,
                    shared_total: 7,
                    completion_rate: 33.3,
                },
                charts: {
                    status: [
                        { key: 'pending', label: 'Pending', count: 3 },
                        { key: 'in-progress', label: 'In Progress', count: 4 },
                        { key: 'completed', label: 'Completed', count: 4 },
                    ],
                    priority: [
                        { key: 'high', label: 'High', count: 3 },
                        { key: 'medium', label: 'Medium', count: 6 },
                        { key: 'low', label: 'Low', count: 3 },
                    ],
                    ownership: [
                        { key: 'mine', label: 'Submitted By You', count: 5 },
                        { key: 'shared', label: 'Shared With You', count: 7 },
                    ],
                    my_status: [
                        { key: 'pending', label: 'Pending', count: 1 },
                        { key: 'in-progress', label: 'In Progress', count: 1 },
                    ],
                    environments: [
                        { key: 'production', label: 'Production', count: 10 },
                    ],
                    projects: [
                        { project: 'Alpha', count: 6 },
                        { project: 'Beta', count: 4 },
                    ],
                    throughput: [
                        { week_start: '2026-02-02', label: 'Feb 2', created: 4, completed: 2 },
                        { week_start: '2026-02-09', label: 'Feb 9', created: 5, completed: 4 },
                    ],
                },
            },
        });

        const wrapper = mount(Dashboard);
        await flushPromises();

        expect(getMock).toHaveBeenCalledWith('/shift/api/dashboard');
        expect(wrapper.get('[data-testid="metric-total"]').text()).toBe('12');
        expect(wrapper.get('[data-testid="metric-open"]').text()).toBe('7');
        expect(wrapper.get('[data-testid="metric-mine"]').text()).toBe('5');
        expect(wrapper.get('[data-testid="metric-high-priority"]').text()).toBe('3');

        expect(wrapper.text()).toContain('Project Dashboard');
        expect(wrapper.text()).toContain('Weekly Throughput');
        expect(wrapper.text()).toContain('Status Distribution');
        expect(wrapper.text()).toContain('Priority Mix');
        expect(wrapper.text()).toContain('Project Load');
        expect(wrapper.text()).toContain('Ownership Split');
        expect(wrapper.text()).toContain('Your Status Mix');
    });

    it('renders error state when dashboard request fails', async () => {
        getMock.mockRejectedValueOnce({
            response: {
                data: {
                    error: 'Cannot fetch dashboard',
                },
            },
        });

        const wrapper = mount(Dashboard);
        await flushPromises();

        expect(wrapper.get('[data-testid="dashboard-error"]').text()).toContain('Cannot fetch dashboard');
    });
});
