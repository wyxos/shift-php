<script setup lang="ts">
import { Badge } from '@shift/ui/badge';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shift/ui/card';
import { ChartContainer } from '@shift/ui/chart';
import { VisAxis, VisDonut, VisGroupedBar, VisSingleContainer, VisXYContainer } from '@unovis/vue';
import { CheckCircle2, Clock3, Flame, UserCircle2 } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useDashboardData } from './dashboard/useDashboardData';

const router = useRouter();
const {
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
} = useDashboardData();
</script>



<template>
    <div class="flex h-full flex-1 flex-col gap-4" data-testid="dashboard-view">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-2xl font-semibold tracking-tight">Project Dashboard</h1>
                <p class="text-muted-foreground text-sm">Workload and personal ownership metrics for this SHIFT project scope.</p>
            </div>
            <Button variant="outline" @click="router.push('/tasks')">Open Tasks</Button>
        </div>

        <div v-if="loading" class="text-muted-foreground py-10 text-sm" data-testid="dashboard-loading">Loading dashboard data…</div>

        <Card v-else-if="error" class="border-destructive/40" data-testid="dashboard-error">
            <CardHeader>
                <CardTitle>Dashboard Unavailable</CardTitle>
                <CardDescription>{{ error }}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button @click="fetchDashboard">Retry</Button>
            </CardContent>
        </Card>

        <template v-else>
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader class="pb-2">
                        <CardDescription>Total Visible Tasks</CardDescription>
                        <CardTitle class="text-3xl" data-testid="metric-total">{{ metrics.total }}</CardTitle>
                    </CardHeader>
                    <CardContent class="text-muted-foreground text-xs">All tasks currently visible to your account.</CardContent>
                </Card>

                <Card>
                    <CardHeader class="pb-2">
                        <CardDescription>Open Work</CardDescription>
                        <CardTitle class="text-3xl" data-testid="metric-open">{{ metrics.open }}</CardTitle>
                    </CardHeader>
                    <CardContent class="text-muted-foreground flex items-center gap-2 text-xs">
                        <Clock3 class="h-3.5 w-3.5" />
                        Pending + In Progress + Awaiting Feedback
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader class="pb-2">
                        <CardDescription>Submitted By You</CardDescription>
                        <CardTitle class="text-3xl" data-testid="metric-mine">{{ metrics.mine_total }}</CardTitle>
                    </CardHeader>
                    <CardContent class="text-muted-foreground flex items-center gap-2 text-xs">
                        <UserCircle2 class="h-3.5 w-3.5" />
                        {{ metrics.mine_open }} still open in your own submissions
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader class="pb-2">
                        <CardDescription>High Priority Open</CardDescription>
                        <CardTitle class="text-3xl" data-testid="metric-high-priority">{{ metrics.high_priority_open }}</CardTitle>
                    </CardHeader>
                    <CardContent class="text-muted-foreground flex items-center gap-2 text-xs">
                        <Flame class="h-3.5 w-3.5" />
                        Urgent tasks not yet resolved
                    </CardContent>
                </Card>
            </div>

            <div class="grid gap-4 xl:grid-cols-3">
                <Card class="xl:col-span-2">
                    <CardHeader class="pb-2">
                        <CardTitle>Weekly Throughput</CardTitle>
                        <CardDescription>Created vs completed trend across the last 6 weeks.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div v-if="throughputData.length === 0" class="text-muted-foreground py-8 text-center text-sm">No throughput history yet.</div>
                        <ChartContainer v-else :config="throughputChartConfig" class="h-[300px] w-full" cursor>
                            <VisXYContainer :data="throughputData" :margin="{ left: -12, right: 12 }" :y-domain="[0, undefined]">
                                <VisGroupedBar
                                    :x="throughputX"
                                    :y="[throughputCreated, throughputCompleted]"
                                    :color="[throughputChartConfig.created.color, throughputChartConfig.completed.color]"
                                    :rounded-corners="6"
                                />
                                <VisAxis
                                    type="x"
                                    :x="throughputX"
                                    :tick-values="throughputTickValues"
                                    :tick-line="false"
                                    :domain-line="false"
                                    :grid-line="false"
                                    :tick-format="formatDateTick"
                                />
                                <VisAxis type="y" :num-ticks="4" :tick-line="false" :domain-line="false" />
                            </VisXYContainer>
                        </ChartContainer>
                        <div class="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                            <span>Net backlog change in current window</span>
                            <Badge :variant="throughputDelta <= 0 ? 'secondary' : 'outline'">
                                {{ throughputDelta > 0 ? '+' : '' }}{{ throughputDelta }}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader class="pb-2">
                        <CardTitle>Status Distribution</CardTitle>
                        <CardDescription>Current workload mix by status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div v-if="statusData.length === 0" class="text-muted-foreground py-8 text-center text-sm">No status data yet.</div>
                        <ChartContainer v-else :config="statusChartConfig" class="mx-auto h-[300px] max-w-[320px]">
                            <VisSingleContainer :data="statusData" :margin="{ top: 10, bottom: 10 }">
                                <VisDonut
                                    :value="statusDonutValue"
                                    :color="statusDonutColor"
                                    :arc-width="24"
                                    :corner-radius="3"
                                />
                            </VisSingleContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader class="pb-2">
                        <CardTitle>Priority Mix</CardTitle>
                        <CardDescription>Volume by priority level.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div v-if="priorityData.length === 0" class="text-muted-foreground py-8 text-center text-sm">No priority data yet.</div>
                        <ChartContainer v-else :config="priorityChartConfig" class="h-[280px] w-full" cursor>
                            <VisXYContainer :data="priorityData" :margin="{ left: 8, right: 12 }" :y-domain="[0, undefined]">
                                <VisGroupedBar
                                    :x="barOrder"
                                    :y="barValue"
                                    :color="priorityBarColor"
                                    :group-max-width="42"
                                    :group-padding="0.2"
                                    :rounded-corners="8"
                                />
                                <VisAxis
                                    type="x"
                                    :x="barOrder"
                                    :tick-values="priorityTickValues"
                                    :tick-line="false"
                                    :domain-line="false"
                                    :grid-line="false"
                                    :tick-format="formatPriorityTick"
                                />
                                <VisAxis type="y" :num-ticks="4" :tick-line="false" :domain-line="false" />
                            </VisXYContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader class="pb-2">
                        <CardTitle>Project Load</CardTitle>
                        <CardDescription>Top projects by visible task volume.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div v-if="projectData.length === 0" class="text-muted-foreground py-8 text-center text-sm">No project data yet.</div>
                        <ChartContainer v-else :config="projectChartConfig" class="h-[280px] w-full" cursor>
                            <VisXYContainer :data="projectData" :margin="{ left: 12, right: 12 }" :y-domain="[0, undefined]">
                                <VisGroupedBar
                                    :x="barOrder"
                                    :y="barValue"
                                    :color="projectBarColor"
                                    :group-max-width="42"
                                    :group-padding="0.2"
                                    :rounded-corners="8"
                                />
                                <VisAxis
                                    type="x"
                                    :x="barOrder"
                                    :tick-values="projectTickValues"
                                    :tick-line="false"
                                    :domain-line="false"
                                    :grid-line="false"
                                    :tick-format="formatProjectTick"
                                />
                                <VisAxis type="y" :num-ticks="4" :tick-line="false" :domain-line="false" />
                            </VisXYContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader class="pb-2">
                        <CardTitle>Ownership Split</CardTitle>
                        <CardDescription>Tasks submitted by you vs shared visibility.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div v-if="ownershipData.length === 0" class="text-muted-foreground py-8 text-center text-sm">No ownership data yet.</div>
                        <div v-else class="grid gap-4 md:grid-cols-[240px_1fr] md:items-center">
                            <ChartContainer :config="ownershipChartConfig" class="mx-auto h-[220px] w-full max-w-[240px]">
                                <VisSingleContainer :data="ownershipData" :margin="{ top: 8, bottom: 8 }">
                                    <VisDonut
                                        :value="ownershipDonutValue"
                                        :color="ownershipDonutColor"
                                        :arc-width="20"
                                        :corner-radius="3"
                                    />
                                </VisSingleContainer>
                            </ChartContainer>
                            <div class="space-y-2">
                                <div
                                    v-for="segment in ownershipData"
                                    :key="segment.segment"
                                    class="border-border bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2"
                                >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="h-2.5 w-2.5 rounded-sm"
                                            :style="{ backgroundColor: ownershipChartConfig[segment.segment as keyof typeof ownershipChartConfig]?.color }"
                                        />
                                        <span class="text-sm font-medium">{{ segment.label }}</span>
                                    </div>
                                    <span class="text-muted-foreground text-sm">{{ segment.value }}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader class="pb-2">
                        <CardTitle>Your Status Mix</CardTitle>
                        <CardDescription>How your submitted tasks are currently distributed.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div v-if="myStatusData.length === 0" class="text-muted-foreground py-8 text-center text-sm">No personal status data yet.</div>
                        <ChartContainer v-else :config="myStatusChartConfig" class="h-[280px] w-full" cursor>
                            <VisXYContainer :data="myStatusData" :margin="{ left: 8, right: 12 }" :y-domain="[0, undefined]">
                                <VisGroupedBar
                                    :x="barOrder"
                                    :y="barValue"
                                    :color="myStatusBarColor"
                                    :group-max-width="42"
                                    :group-padding="0.2"
                                    :rounded-corners="8"
                                />
                                <VisAxis
                                    type="x"
                                    :x="barOrder"
                                    :tick-values="myStatusTickValues"
                                    :tick-line="false"
                                    :domain-line="false"
                                    :grid-line="false"
                                    :tick-format="formatMyStatusTick"
                                />
                                <VisAxis type="y" :num-ticks="4" :tick-line="false" :domain-line="false" />
                            </VisXYContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            <Card v-if="metrics.awaiting_feedback > 0" class="border-amber-300/70 bg-amber-50/30 dark:border-amber-700/50 dark:bg-amber-950/15">
                <CardContent class="flex items-center gap-3 py-4 text-sm">
                    <CheckCircle2 class="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>
                        {{ metrics.awaiting_feedback }} task{{ metrics.awaiting_feedback === 1 ? '' : 's' }} are awaiting feedback and may block completion.
                    </span>
                </CardContent>
            </Card>
        </template>
    </div>
</template>
