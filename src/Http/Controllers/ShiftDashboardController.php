<?php

namespace Wyxos\Shift\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class ShiftDashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');
        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $tasks = $this->fetchTasks(
                token: (string) $apiToken,
                baseUrl: (string) $baseUrl,
                project: (string) $project,
                user: [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'environment' => config('app.env'),
                    'url' => config('app.url'),
                ],
            );

            $normalizedEmail = Str::of((string) $user->email)->lower()->trim()->toString();

            return response()->json([
                'metrics' => $this->buildMetrics($tasks, $normalizedEmail),
                'charts' => $this->buildCharts($tasks, $normalizedEmail),
            ]);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to load dashboard data: '.$e->getMessage()], 500);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $tasks
     * @return array<string, mixed>
     */
    private function buildMetrics(array $tasks, string $normalizedEmail): array
    {
        $allTasks = collect($tasks);
        $mineTasks = $allTasks->filter(fn (array $task) => $this->isTaskMine($task, $normalizedEmail));

        $openStatuses = ['pending', 'in-progress', 'awaiting-feedback'];

        $total = $allTasks->count();
        $completed = $allTasks->where('status', 'completed')->count();
        $open = $allTasks->filter(fn (array $task) => in_array($this->taskStatus($task), $openStatuses, true))->count();
        $mine = $mineTasks->count();

        return [
            'total' => $total,
            'open' => $open,
            'completed' => $completed,
            'awaiting_feedback' => $allTasks->where('status', 'awaiting-feedback')->count(),
            'high_priority_open' => $allTasks
                ->filter(fn (array $task) => $this->taskPriority($task) === 'high' && in_array($this->taskStatus($task), $openStatuses, true))
                ->count(),
            'mine_total' => $mine,
            'mine_open' => $mineTasks->filter(fn (array $task) => in_array($this->taskStatus($task), $openStatuses, true))->count(),
            'shared_total' => max($total - $mine, 0),
            'completion_rate' => $total > 0 ? round(($completed / $total) * 100, 1) : 0.0,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $tasks
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function buildCharts(array $tasks, string $normalizedEmail): array
    {
        $allTasks = collect($tasks);
        $mineTasks = $allTasks->filter(fn (array $task) => $this->isTaskMine($task, $normalizedEmail));

        $statusLabels = [
            'pending' => 'Pending',
            'in-progress' => 'In Progress',
            'awaiting-feedback' => 'Awaiting Feedback',
            'completed' => 'Completed',
            'closed' => 'Closed',
        ];

        $priorityLabels = [
            'high' => 'High',
            'medium' => 'Medium',
            'low' => 'Low',
        ];

        $statusBreakdown = collect($statusLabels)
            ->map(function (string $label, string $key) use ($allTasks) {
                return [
                    'key' => $key,
                    'label' => $label,
                    'count' => $allTasks->where('status', $key)->count(),
                ];
            })
            ->values();

        $priorityBreakdown = collect($priorityLabels)
            ->map(function (string $label, string $key) use ($allTasks) {
                return [
                    'key' => $key,
                    'label' => $label,
                    'count' => $allTasks->filter(fn (array $task) => $this->taskPriority($task) === $key)->count(),
                ];
            })
            ->values();

        $ownershipBreakdown = collect([
            [
                'key' => 'mine',
                'label' => 'Submitted By You',
                'count' => $mineTasks->count(),
            ],
            [
                'key' => 'shared',
                'label' => 'Shared With You',
                'count' => max($allTasks->count() - $mineTasks->count(), 0),
            ],
        ]);

        $myStatusBreakdown = collect($statusLabels)
            ->map(function (string $label, string $key) use ($mineTasks) {
                return [
                    'key' => $key,
                    'label' => $label,
                    'count' => $mineTasks->where('status', $key)->count(),
                ];
            })
            ->values();

        $environmentBreakdown = $allTasks
            ->map(function (array $task) {
                $environment = data_get($task, 'environment') ?: data_get($task, 'metadata.environment');

                if (! is_string($environment) || trim($environment) === '') {
                    return 'unknown';
                }

                return Str::of($environment)->lower()->trim()->toString();
            })
            ->countBy()
            ->sortDesc()
            ->take(6)
            ->map(function (int $count, string $environment) {
                return [
                    'key' => $environment,
                    'label' => Str::headline($environment),
                    'count' => $count,
                ];
            })
            ->values();

        $projectBreakdown = $allTasks
            ->map(function (array $task) {
                $name = trim((string) data_get($task, 'project.name', 'Unknown'));

                return $name !== '' ? $name : 'Unknown';
            })
            ->countBy()
            ->sortDesc()
            ->take(5)
            ->map(function (int $count, string $project) {
                return [
                    'project' => $project,
                    'count' => $count,
                ];
            })
            ->values();

        $throughput = $this->buildThroughput($allTasks);

        return [
            'status' => $statusBreakdown->all(),
            'priority' => $priorityBreakdown->all(),
            'ownership' => $ownershipBreakdown->all(),
            'my_status' => $myStatusBreakdown->all(),
            'environments' => $environmentBreakdown->all(),
            'projects' => $projectBreakdown->all(),
            'throughput' => $throughput,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $tasks
     * @return array<int, array<string, mixed>>
     */
    private function buildThroughput(Collection $tasks): array
    {
        $weekAnchor = now()->startOfWeek();
        $weekBuckets = collect(range(5, 0))
            ->map(fn (int $offset) => $weekAnchor->copy()->subWeeks($offset));

        $createdByWeek = $tasks
            ->map(fn (array $task) => $this->parseDate(data_get($task, 'created_at')))
            ->filter(fn (?Carbon $date) => $date instanceof Carbon)
            ->countBy(fn (Carbon $date) => $date->copy()->startOfWeek()->toDateString());

        $completedByWeek = $tasks
            ->filter(fn (array $task) => $this->taskStatus($task) === 'completed')
            ->map(fn (array $task) => $this->parseDate(data_get($task, 'updated_at')))
            ->filter(fn (?Carbon $date) => $date instanceof Carbon)
            ->countBy(fn (Carbon $date) => $date->copy()->startOfWeek()->toDateString());

        return $weekBuckets
            ->map(function (Carbon $weekStart) use ($createdByWeek, $completedByWeek) {
                $bucket = $weekStart->toDateString();

                return [
                    'week_start' => $bucket,
                    'label' => $weekStart->format('M j'),
                    'created' => (int) ($createdByWeek[$bucket] ?? 0),
                    'completed' => (int) ($completedByWeek[$bucket] ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $task
     */
    private function taskStatus(array $task): string
    {
        return (string) data_get($task, 'status', 'pending');
    }

    /**
     * @param  array<string, mixed>  $task
     */
    private function taskPriority(array $task): string
    {
        return (string) data_get($task, 'priority', 'medium');
    }

    /**
     * @param  array<string, mixed>  $task
     */
    private function isTaskMine(array $task, string $normalizedEmail): bool
    {
        if ($normalizedEmail === '') {
            return false;
        }

        $submitterEmail = Str::of((string) data_get($task, 'submitter.email'))
            ->lower()
            ->trim()
            ->toString();

        return $submitterEmail !== '' && $submitterEmail === $normalizedEmail;
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $user
     * @return array<int, array<string, mixed>>
     */
    private function fetchTasks(string $token, string $baseUrl, string $project, array $user): array
    {
        $tasks = [];
        $page = 1;
        $maxPages = 100;

        while ($page <= $maxPages) {
            $response = Http::withToken($token)
                ->acceptJson()
                ->get(rtrim($baseUrl, '/').'/api/tasks', $this->buildTaskQuery($project, $user, $page));

            if (! $response->successful()) {
                throw new RuntimeException((string) ($response->json('message') ?? 'Failed to fetch tasks'));
            }

            $payload = $response->json();

            if (is_array($payload) && array_is_list($payload)) {
                $tasks = array_merge($tasks, $payload);
                break;
            }

            $pageTasks = data_get($payload, 'data', []);

            if (is_array($pageTasks)) {
                $tasks = array_merge($tasks, $pageTasks);
            }

            $currentPage = (int) data_get($payload, 'current_page', $page);
            $lastPage = (int) data_get($payload, 'last_page', $currentPage);

            if ($currentPage >= $lastPage) {
                break;
            }

            $page = $currentPage + 1;
        }

        return $tasks;
    }

    /**
     * @param  array<string, mixed>  $user
     * @return array<string, mixed>
     */
    private function buildTaskQuery(string $project, array $user, int $page): array
    {
        return [
            'project' => $project,
            'page' => $page,
            'sort_by' => 'updated_at',
            'user' => [
                'id' => data_get($user, 'id'),
                'name' => data_get($user, 'name'),
                'email' => data_get($user, 'email'),
                'environment' => data_get($user, 'environment'),
                'url' => data_get($user, 'url'),
            ],
            'metadata' => [
                'url' => config('app.url'),
                'environment' => config('app.env'),
            ],
        ];
    }
}
