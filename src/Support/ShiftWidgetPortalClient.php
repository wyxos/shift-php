<?php

namespace Wyxos\Shift\Support;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class ShiftWidgetPortalClient
{
    public function hasConfiguration(): bool
    {
        return filled(config('shift.token')) && filled(config('shift.project'));
    }

    /**
     * @return array{widget_enabled: bool, guest_submissions_enabled: bool}
     */
    public function widgetConfiguration(): array
    {
        $this->ensureConfigured();

        $response = $this->client()->get($this->baseUrl().'/api/widget/config', [
            'project' => (string) config('shift.project'),
        ]);

        if (! $response->successful()) {
            throw new RuntimeException($this->errorMessage($response, 'Failed to load SHIFT widget config.'), $response->status());
        }

        return [
            'widget_enabled' => (bool) $response->json('widget_enabled'),
            'guest_submissions_enabled' => (bool) $response->json('guest_submissions_enabled'),
        ];
    }

    public function submitWidgetTask(array $payload): Response
    {
        $this->ensureConfigured();

        return $this->client()->post($this->baseUrl().'/api/widget/tasks', [
            'project' => (string) config('shift.project'),
            ...$payload,
        ]);
    }

    public function configurationErrorMessage(): string
    {
        return 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env';
    }

    private function ensureConfigured(): void
    {
        if (! $this->hasConfiguration()) {
            throw new RuntimeException($this->configurationErrorMessage(), 500);
        }
    }

    private function errorMessage(Response $response, string $fallback): string
    {
        $message = $response->json('message') ?? $response->json('error') ?? null;

        return is_string($message) && trim($message) !== '' ? $message : $fallback;
    }

    private function client(): PendingRequest
    {
        $request = Http::withToken((string) config('shift.token'))
            ->acceptJson();

        if ($this->isLocalOrPrivateUrl($this->baseUrl())) {
            $request = $request->withoutVerifying();
        }

        return $request;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('shift.url', 'https://shift.wyxos.com'), '/');
    }

    private function isLocalOrPrivateUrl(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            return true;
        }

        if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
            return true;
        }

        if (Str::endsWith($host, ['.test', '.local'])) {
            return true;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
        }

        return false;
    }
}
