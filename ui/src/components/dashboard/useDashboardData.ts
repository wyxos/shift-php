import axios from '@/axios-config';
import { type ChartConfig } from '@shift/ui/chart';
import { computed, onMounted, ref } from 'vue';

type SegmentCount = {
    key: string;
    label: string;
    count: number;
};

type ThroughputPoint = {
    week_start: string;
    label: string;
    created: number;
    completed: number;
};

type ProjectPoint = {
    project: string;
    count: number;
};

type DashboardMetrics = {
    total: number;
    open: number;
    completed: number;
    awaiting_feedback: number;
    high_priority_open: number;
    mine_total: number;
    mine_open: number;
    shared_total: number;
    completion_rate: number;
};

type DashboardCharts = {
    status: SegmentCount[];
    priority: SegmentCount[];
    ownership: SegmentCount[];
    my_status: SegmentCount[];
    environments: SegmentCount[];
    throughput: ThroughputPoint[];
    projects: ProjectPoint[];
};

type DashboardPayload = {
    metrics?: Partial<DashboardMetrics>;
    charts?: Partial<DashboardCharts>;
};

type DonutDatum = {
    segment: string;
    label: string;
    value: number;
};

type OrderedDatum = {
    key: string;
    label: string;
    value: number;
    order: number;
};

type ProjectDatum = {
    key: string;
    project: string;
    shortLabel: string;
    value: number;
    order: number;
};

type ThroughputDatum = ThroughputPoint & {
    date: Date;
};

const chartPalette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const initialMetrics: DashboardMetrics = {
    total: 0,
    open: 0,
    completed: 0,
    awaiting_feedback: 0,
    high_priority_open: 0,
    mine_total: 0,
    mine_open: 0,
    shared_total: 0,
    completion_rate: 0,
};

const initialCharts: DashboardCharts = {
    status: [],
    priority: [],
    ownership: [],
    my_status: [],
    environments: [],
    throughput: [],
    projects: [],
};

export function useDashboardData() {
    const loading = ref(true);
    const error = ref<string | null>(null);

    const metrics = ref<DashboardMetrics>({ ...initialMetrics });
    const charts = ref<DashboardCharts>({ ...initialCharts });

    const statusData = computed(() =>
        charts.value.status
            .filter((segment) => segment.count > 0)
            .map((segment) => ({
                segment: segment.key,
                label: segment.label,
                value: segment.count,
            })),
    );

    const ownershipData = computed(() =>
        charts.value.ownership
            .filter((segment) => segment.count > 0)
            .map((segment) => ({
                segment: segment.key,
                label: segment.label,
                value: segment.count,
            })),
    );

    const priorityData = computed(() =>
        charts.value.priority.map((segment, index) => ({
            key: segment.key,
            label: segment.label,
            value: segment.count,
            order: index,
        })),
    );

    const myStatusData = computed(() =>
        charts.value.my_status.map((segment, index) => ({
            key: segment.key,
            label: segment.label,
            value: segment.count,
            order: index,
        })),
    );

    const projectData = computed(() =>
        charts.value.projects.map((project, index) => ({
            key: `project-${index}`,
            project: project.project,
            shortLabel: project.project.length > 16 ? `${project.project.slice(0, 16)}…` : project.project,
            value: project.count,
            order: index,
        })),
    );

    const throughputData = computed(() =>
        charts.value.throughput.map((point) => ({
            ...point,
            date: new Date(point.week_start),
        })),
    );

    const statusChartConfig = {
        value: {
            label: 'Tasks',
            color: 'var(--chart-1)',
        },
        pending: {
            label: 'Pending',
            color: 'var(--chart-4)',
        },
        'in-progress': {
            label: 'In Progress',
            color: 'var(--chart-1)',
        },
        'awaiting-feedback': {
            label: 'Awaiting Feedback',
            color: 'var(--chart-3)',
        },
        completed: {
            label: 'Completed',
            color: 'var(--chart-2)',
        },
        closed: {
            label: 'Closed',
            color: 'var(--chart-5)',
        },
    } satisfies ChartConfig;

    const ownershipChartConfig = {
        value: {
            label: 'Tasks',
            color: 'var(--chart-1)',
        },
        mine: {
            label: 'Submitted By You',
            color: 'var(--chart-1)',
        },
        shared: {
            label: 'Shared With You',
            color: 'var(--chart-3)',
        },
    } satisfies ChartConfig;

    const priorityChartConfig = {
        value: {
            label: 'Tasks',
            color: 'var(--chart-1)',
        },
        high: {
            label: 'High',
            color: 'var(--chart-1)',
        },
        medium: {
            label: 'Medium',
            color: 'var(--chart-3)',
        },
        low: {
            label: 'Low',
            color: 'var(--chart-5)',
        },
    } satisfies ChartConfig;

    const throughputChartConfig = {
        created: {
            label: 'Created',
            color: 'var(--chart-4)',
        },
        completed: {
            label: 'Completed',
            color: 'var(--chart-2)',
        },
    } satisfies ChartConfig;

    const myStatusChartConfig = computed<ChartConfig>(() => {
        const config: ChartConfig = {
            value: {
                label: 'Tasks',
                color: 'var(--chart-1)',
            },
        };

        myStatusData.value.forEach((item, index) => {
            config[item.key] = {
                label: item.label,
                color: chartPalette[index % chartPalette.length],
            };
        });

        return config;
    });

    const projectChartConfig = computed<ChartConfig>(() => {
        const config: ChartConfig = {
            value: {
                label: 'Tasks',
                color: 'var(--chart-1)',
            },
        };

        projectData.value.forEach((item, index) => {
            config[item.key] = {
                label: item.project,
                color: chartPalette[index % chartPalette.length],
            };
        });

        return config;
    });

    const throughputDelta = computed(() => {
        const created = throughputData.value.reduce((sum, item) => sum + item.created, 0);
        const completed = throughputData.value.reduce((sum, item) => sum + item.completed, 0);

        return created - completed;
    });

    const throughputTickValues = computed(() => throughputData.value.map((item) => item.date));
    const priorityTickValues = computed(() => priorityData.value.map((item) => item.order));
    const projectTickValues = computed(() => projectData.value.map((item) => item.order));
    const myStatusTickValues = computed(() => myStatusData.value.map((item) => item.order));

    function applyDashboardPayload(payload: DashboardPayload) {
        metrics.value = {
            ...metrics.value,
            ...(payload.metrics ?? {}),
        };

        charts.value = {
            ...charts.value,
            ...(payload.charts ?? {}),
        };
    }

    async function fetchDashboard() {
        loading.value = true;
        error.value = null;

        try {
            const response = await axios.get('/shift/api/dashboard');
            const payload = (response.data?.data ?? response.data ?? {}) as DashboardPayload;
            applyDashboardPayload(payload);
        } catch (e: any) {
            error.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to load dashboard data';
        } finally {
            loading.value = false;
        }
    }

    onMounted(() => {
        void fetchDashboard();
    });

    function throughputX(item: ThroughputDatum): Date {
        return item.date;
    }

    function throughputCreated(item: ThroughputDatum): number {
        return item.created;
    }

    function throughputCompleted(item: ThroughputDatum): number {
        return item.completed;
    }

    function barOrder(item: OrderedDatum | ProjectDatum): number {
        return item.order;
    }

    function barValue(item: OrderedDatum | ProjectDatum): number {
        return item.value;
    }

    function statusDonutValue(item: DonutDatum): number {
        return item.value;
    }

    function statusDonutColor(item: DonutDatum): string | undefined {
        return statusChartConfig[item.segment as keyof typeof statusChartConfig]?.color;
    }

    function ownershipDonutValue(item: DonutDatum): number {
        return item.value;
    }

    function ownershipDonutColor(item: DonutDatum): string | undefined {
        return ownershipChartConfig[item.segment as keyof typeof ownershipChartConfig]?.color;
    }

    function priorityBarColor(item: OrderedDatum): string | undefined {
        return priorityChartConfig[item.key as keyof typeof priorityChartConfig]?.color;
    }

    function projectBarColor(item: ProjectDatum): string | undefined {
        return projectChartConfig.value[item.key as keyof typeof projectChartConfig.value]?.color;
    }

    function myStatusBarColor(item: OrderedDatum): string | undefined {
        return myStatusChartConfig.value[item.key as keyof typeof myStatusChartConfig.value]?.color;
    }

    function formatDateTick(value: number): string {
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatPriorityTick(value: number): string {
        return priorityData.value[value]?.label ?? '';
    }

    function formatProjectTick(value: number): string {
        return projectData.value[value]?.shortLabel ?? '';
    }

    function formatMyStatusTick(value: number): string {
        return myStatusData.value[value]?.label ?? '';
    }

    return {
        loading,
        error,
        metrics,
        statusData,
        ownershipData,
        priorityData,
        myStatusData,
        projectData,
        throughputData,
        statusChartConfig,
        ownershipChartConfig,
        priorityChartConfig,
        throughputChartConfig,
        myStatusChartConfig,
        projectChartConfig,
        throughputDelta,
        throughputTickValues,
        priorityTickValues,
        projectTickValues,
        myStatusTickValues,
        throughputX,
        throughputCreated,
        throughputCompleted,
        barOrder,
        barValue,
        statusDonutValue,
        statusDonutColor,
        ownershipDonutValue,
        ownershipDonutColor,
        priorityBarColor,
        projectBarColor,
        myStatusBarColor,
        formatDateTick,
        formatPriorityTick,
        formatProjectTick,
        formatMyStatusTick,
        fetchDashboard,
    };
}
