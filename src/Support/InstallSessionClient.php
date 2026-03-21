<?php

namespace Wyxos\Shift\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class InstallSessionClient
{
    private const CREATE_PATHS = [
        '/api/sdk/install/sessions',
        '/api/install-sessions',
        '/api/sdk/install-sessions',
    ];

    private const POLL_PATHS = [
        '/api/sdk/install/sessions/poll',
    ];

    private const PROJECTS_PATHS = [
        '/api/sdk/install/sessions/projects',
    ];

    private const FINALIZE_PATHS = [
        '/api/sdk/install/sessions/finalize',
    ];

    private const SESSION_RESOURCE_PATHS = [
        '/api/install-sessions',
        '/api/sdk/install-sessions',
    ];

    public function __construct(
        private readonly string $baseUrl,
        private readonly bool $skipSslVerification = false,
    ) {}

    public function create(array $context): array
    {
        $response = $this->requestJsonWithFallbacks([
            $this->attempt(
                'POST',
                $this->candidateUrls(self::CREATE_PATHS),
                array_filter([
                    'environment' => $context['environment'] ?? null,
                    'app_env' => $context['environment'] ?? null,
                    'url' => $context['url'] ?? null,
                    'app_url' => $context['url'] ?? null,
                ], static fn ($value) => $value !== null && $value !== ''),
            ),
        ], 'Unable to create a SHIFT install session.');

        return $this->normalizeSession($response);
    }

    public function poll(array $session): array
    {
        $sessionId = $this->requireSessionId($session);

        $response = $this->requestJsonWithFallbacks(array_filter([
            $this->attemptIfUrls('GET', $this->sessionUrls($session, ['status_url', 'poll_url', 'session_url']), $this->sessionQuery($session)),
            $this->attempt('POST', $this->candidateUrls(self::POLL_PATHS), [
                'device_code' => $sessionId,
                'session' => $sessionId,
                'session_id' => $sessionId,
            ]),
            $this->attempt('GET', $this->restfulSessionUrls($sessionId, ['', '/status']), $this->sessionQuery($session)),
        ]), 'Unable to check the SHIFT install session status.');

        return $this->normalizeSession(array_replace_recursive($session, $response));
    }

    public function projects(array $session): array
    {
        $sessionId = $this->requireSessionId($session);

        $response = $this->requestJsonWithFallbacks(array_filter([
            $this->attemptIfUrls('GET', $this->sessionUrls($session, ['projects_url']), $this->sessionQuery($session)),
            $this->attempt('POST', $this->candidateUrls(self::PROJECTS_PATHS), [
                'device_code' => $sessionId,
                'session' => $sessionId,
                'session_id' => $sessionId,
            ]),
            $this->attempt('GET', $this->restfulSessionUrls($sessionId, ['/projects']), $this->sessionQuery($session)),
        ]), 'Unable to load installable SHIFT projects.');

        $projects = $this->normalizeProjects($response);

        if ($projects === []) {
            throw new RuntimeException('SHIFT did not return any installable projects for this session.');
        }

        return $projects;
    }

    public function finalize(array $session, array $project): array
    {
        $sessionId = $this->requireSessionId($session);
        $payload = array_filter([
            'device_code' => $sessionId,
            'session' => $sessionId,
            'session_id' => $sessionId,
            'install_session' => $sessionId,
            'project' => $project['token'] ?? $project['id'] ?? null,
            'project_id' => $project['id'] ?? null,
            'project_token' => $project['token'] ?? null,
            'selection' => $project['id'] ?? $project['token'] ?? null,
        ], static fn ($value) => $value !== null && $value !== '');

        $response = $this->requestJsonWithFallbacks(array_filter([
            $this->attemptIfUrls('POST', $this->sessionUrls($session, ['finalize_url']), $payload),
            $this->attempt('POST', $this->candidateUrls(self::FINALIZE_PATHS), $payload),
            $this->attempt('POST', $this->restfulSessionUrls($sessionId, ['/finalize']), $payload),
        ]), 'Unable to finalize the SHIFT install session.');

        $token = $this->stringValue($response, [
            'data.shift_token',
            'data.user_token',
            'data.api_token',
            'data.access_token',
            'data.token',
            'shift_token',
            'user_token',
            'api_token',
            'access_token',
            'token',
        ]);

        $projectToken = $this->stringValue($response, [
            'data.project.token',
            'data.project_token',
            'project.token',
            'project_token',
        ]) ?? ($project['token'] ?? null);

        if ($token === null || $projectToken === null) {
            throw new RuntimeException('SHIFT install session finalization did not return usable credentials.');
        }

        return [
            'token' => $token,
            'project' => $projectToken,
        ];
    }

    private function requestJsonWithFallbacks(array $attempts, string $defaultError): array
    {
        $lastMissingEndpointError = null;

        foreach ($attempts as $attempt) {
            if (! is_array($attempt)) {
                continue;
            }

            $method = strtoupper((string) ($attempt['method'] ?? 'GET'));
            $urls = array_values(array_filter(array_unique($attempt['urls'] ?? []), static fn ($url) => is_string($url) && $url !== ''));
            $payload = is_array($attempt['payload'] ?? null) ? $attempt['payload'] : [];

            foreach ($urls as $url) {
                try {
                    $request = $this->request();

                    $response = $method === 'GET'
                        ? $request->get($url, $payload)
                        : $request->send($method, $url, ['json' => $payload]);
                } catch (ConnectionException $exception) {
                    throw new RuntimeException($defaultError.' SHIFT could not be reached.', previous: $exception);
                }

                if (in_array($response->status(), [404, 405], true)) {
                    $lastMissingEndpointError = $this->messageFromResponse($response, $defaultError);

                    continue;
                }

                if (! $response->successful()) {
                    throw new RuntimeException($this->messageFromResponse($response, $defaultError));
                }

                $json = $response->json();

                if (! is_array($json)) {
                    throw new RuntimeException($defaultError.' SHIFT returned an invalid response.');
                }

                return $json;
            }
        }

        throw new RuntimeException($lastMissingEndpointError ?? $defaultError);
    }

    private function request(): PendingRequest
    {
        $request = Http::acceptJson();

        if ($this->skipSslVerification) {
            $request = $request->withoutVerifying();
        }

        return $request;
    }

    private function normalizeSession(array $payload): array
    {
        $expiresAt = $this->stringValue($payload, [
            'data.expires_at',
            'expires_at',
            'data.expiresAt',
            'expiresAt',
        ]);

        $expiresIn = $this->intValue($payload, [
            'data.expires_in',
            'expires_in',
            'data.expiresIn',
            'expiresIn',
        ]);

        if ($expiresAt === null && $expiresIn !== null) {
            $expiresAt = now()->addSeconds($expiresIn)->toIso8601String();
        }

        return array_filter([
            'id' => $this->stringValue($payload, [
                'data.device_code',
                'data.session_id',
                'data.id',
                'data.session.id',
                'device_code',
                'session_id',
                'id',
                'session.id',
                'data.session_token',
                'session_token',
                'data.session',
                'session',
            ]),
            'status' => Str::lower($this->stringValue($payload, [
                'data.status',
                'data.state',
                'status',
                'state',
            ]) ?? 'pending'),
            'verification_url' => $this->normalizeUrl($this->stringValue($payload, [
                'data.verification_uri_complete',
                'data.verification_url',
                'data.verification_uri',
                'data.verification.url',
                'data.verification.uri',
                'verification_uri_complete',
                'verification_url',
                'verification_uri',
                'verification.url',
                'verification.uri',
            ])),
            'short_code' => $this->stringValue($payload, [
                'data.short_code',
                'data.user_code',
                'data.code',
                'short_code',
                'user_code',
                'code',
            ]),
            'expires_at' => $expiresAt,
            'poll_interval' => $this->intValue($payload, [
                'data.poll_interval_seconds',
                'data.poll_interval',
                'poll_interval_seconds',
                'poll_interval',
                'data.interval',
                'interval',
            ]) ?? 3,
            'status_url' => $this->normalizeUrl($this->stringValue($payload, [
                'data.status_url',
                'data.poll_url',
                'data.links.status',
                'data.urls.status',
                'status_url',
                'poll_url',
                'links.status',
                'urls.status',
            ])),
            'session_url' => $this->normalizeUrl($this->stringValue($payload, [
                'data.session_url',
                'data.links.self',
                'data.urls.self',
                'session_url',
                'links.self',
                'urls.self',
            ])),
            'projects_url' => $this->normalizeUrl($this->stringValue($payload, [
                'data.projects_url',
                'data.links.projects',
                'data.urls.projects',
                'projects_url',
                'links.projects',
                'urls.projects',
            ])),
            'finalize_url' => $this->normalizeUrl($this->stringValue($payload, [
                'data.finalize_url',
                'data.links.finalize',
                'data.urls.finalize',
                'finalize_url',
                'links.finalize',
                'urls.finalize',
            ])),
        ], static fn ($value) => $value !== null && $value !== '');
    }

    private function normalizeProjects(array $payload): array
    {
        $items = $this->listValue($payload, [
            'data.projects',
            'projects',
            'data',
        ]);

        $projects = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $id = $this->stringValue($item, [
                'id',
                'uuid',
                'project_id',
                'token',
                'project_token',
            ]);

            $token = $this->stringValue($item, [
                'token',
                'project_token',
            ]);

            $name = $this->stringValue($item, [
                'name',
                'title',
            ]);

            $client = $this->stringValue($item, [
                'client_name',
                'client.name',
                'client',
            ]);

            $organisation = $this->stringValue($item, [
                'organisation_name',
                'organization_name',
                'organisation.name',
                'organization.name',
                'organisation',
                'organization',
            ]);

            $label = $this->stringValue($item, ['label']);

            if ($label === null) {
                $label = implode(' / ', array_values(array_filter([
                    $organisation,
                    $client,
                    $name,
                ], static fn ($value) => $value !== null && $value !== '')));
            }

            if ($label === '') {
                $label = $name ?? $token ?? $id ?? 'Unnamed project';
            }

            $projects[] = [
                'id' => $id ?? $token ?? $label,
                'token' => $token,
                'name' => $name ?? $label,
                'label' => $label,
                'raw' => $item,
            ];
        }

        return $projects;
    }

    private function attempt(string $method, array $urls, array $payload): array
    {
        return [
            'method' => $method,
            'urls' => $urls,
            'payload' => $payload,
        ];
    }

    private function attemptIfUrls(string $method, array $urls, array $payload): ?array
    {
        return $urls === [] ? null : $this->attempt($method, $urls, $payload);
    }

    private function requireSessionId(array $session): string
    {
        $sessionId = $session['id'] ?? null;

        if (! is_string($sessionId) || $sessionId === '') {
            throw new RuntimeException('SHIFT install session response did not include a usable device code.');
        }

        return $sessionId;
    }

    private function candidateUrls(array $paths): array
    {
        return array_map(fn (string $path) => rtrim($this->baseUrl, '/').$path, $paths);
    }

    private function restfulSessionUrls(string $sessionId, array $suffixes): array
    {
        $encodedSessionId = rawurlencode($sessionId);
        $urls = [];

        foreach (self::SESSION_RESOURCE_PATHS as $resourcePath) {
            foreach ($suffixes as $suffix) {
                $urls[] = rtrim($this->baseUrl, '/').$resourcePath.'/'.$encodedSessionId.$suffix;
            }
        }

        return array_values(array_unique($urls));
    }

    private function sessionUrls(array $session, array $keys): array
    {
        $urls = [];

        foreach ($keys as $key) {
            $url = $session[$key] ?? null;

            if (is_string($url) && $url !== '') {
                $urls[] = $this->normalizeUrl($url);
            }
        }

        return array_values(array_filter(array_unique($urls), static fn ($url) => is_string($url) && $url !== ''));
    }

    private function sessionQuery(array $session): array
    {
        $sessionId = $session['id'] ?? null;

        if (! is_string($sessionId) || $sessionId === '') {
            return [];
        }

        return [
            'session' => $sessionId,
            'session_id' => $sessionId,
        ];
    }

    private function messageFromResponse(Response $response, string $defaultError): string
    {
        $message = $response->json('message') ?? $response->json('error');

        return is_string($message) && $message !== ''
            ? $message
            : $defaultError;
    }

    private function normalizeUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        return Str::startsWith($url, ['http://', 'https://'])
            ? $url
            : rtrim($this->baseUrl, '/').'/'.ltrim($url, '/');
    }

    private function stringValue(array $payload, array $paths): ?string
    {
        foreach ($paths as $path) {
            $value = $this->pathValue($payload, $path);

            if (is_string($value)) {
                $value = trim($value);

                if ($value !== '') {
                    return $value;
                }
            }

            if (is_int($value) || is_float($value)) {
                return (string) $value;
            }
        }

        return null;
    }

    private function intValue(array $payload, array $paths): ?int
    {
        foreach ($paths as $path) {
            $value = $this->pathValue($payload, $path);

            if (is_int($value)) {
                return $value;
            }

            if (is_string($value) && is_numeric($value)) {
                return (int) $value;
            }
        }

        return null;
    }

    private function listValue(array $payload, array $paths): array
    {
        foreach ($paths as $path) {
            $value = $this->pathValue($payload, $path);

            if (is_array($value) && array_is_list($value)) {
                return $value;
            }
        }

        return [];
    }

    private function pathValue(array $payload, string $path): mixed
    {
        $segments = explode('.', $path);
        $value = $payload;

        foreach ($segments as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return null;
            }

            $value = $value[$segment];
        }

        return $value;
    }
}
