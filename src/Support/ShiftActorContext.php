<?php

namespace Wyxos\Shift\Support;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ShiftActorContext
{
    public const EXTERNAL_ROLES = [
        'owner',
        'client_developer',
        'shift_lead_developer',
        'shift_developer',
        'user',
        'guest',
    ];

    public function configurationErrorResponse(): ?JsonResponse
    {
        if (blank(config('shift.token')) || blank(config('shift.project'))) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public function userPayload(?Authenticatable $user = null): array
    {
        $user ??= auth()->user();

        return [
            'name' => data_get($user, 'name'),
            'email' => data_get($user, 'email'),
            'id' => data_get($user, 'id') ?? $user?->getAuthIdentifier(),
            'environment' => config('app.env'),
            'url' => config('app.url'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function basePayload(?Authenticatable $user = null): array
    {
        return [
            'project' => config('shift.project'),
            'user' => $this->userPayload($user),
            'metadata' => $this->metadataPayload(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function metadataPayload(): array
    {
        return [
            'url' => config('app.url'),
            'environment' => config('app.env'),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function externalRoles(): array
    {
        return self::EXTERNAL_ROLES;
    }

    public function baseUrl(): string
    {
        return rtrim((string) config('shift.url', 'https://shift.wyxos.com'), '/');
    }

    public function client(?string $token = null, ?string $baseUrl = null): PendingRequest
    {
        $baseUrl ??= $this->baseUrl();
        $token ??= (string) config('shift.token');

        $request = Http::withToken($token)
            ->acceptJson();

        if ($this->isLocalOrPrivateUrl($baseUrl)) {
            $request = $request->withoutVerifying();
        }

        return $request;
    }

    public function isLocalOrPrivateUrl(string $url): bool
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
