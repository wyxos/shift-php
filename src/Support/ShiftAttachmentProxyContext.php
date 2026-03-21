<?php

namespace Wyxos\Shift\Support;

use Illuminate\Contracts\Auth\Authenticatable;

class ShiftAttachmentProxyContext
{
    public function __construct(
        private string $token,
        private string $project,
        private string $baseUrl,
        private ?Authenticatable $user = null,
    ) {}

    public function token(): string
    {
        return $this->token;
    }

    public function project(): string
    {
        return $this->project;
    }

    public function baseUrl(): string
    {
        return $this->baseUrl;
    }

    public function url(string $path): string
    {
        return rtrim($this->baseUrl, '/').'/'.ltrim($path, '/');
    }

    public function jsonPayload(array $attributes = [], bool $includeUser = true, bool $includeMetadata = true): array
    {
        $payload = array_merge($attributes, [
            'project' => $this->project,
        ]);

        if ($includeUser && $this->user) {
            $payload['user'] = $this->userPayload();
        }

        if ($includeMetadata) {
            $payload['metadata'] = $this->metadataPayload();
        }

        return $payload;
    }

    public function multipartPayload(array $fields, bool $includeUser = true, bool $includeMetadata = true): array
    {
        $payload = array_values($fields);
        $payload[] = $this->multipartField('project', $this->project);

        if ($includeUser && $this->user) {
            foreach ($this->userPayload() as $key => $value) {
                $payload[] = $this->multipartField("user[$key]", $value);
            }
        }

        if ($includeMetadata) {
            foreach ($this->metadataPayload() as $key => $value) {
                $payload[] = $this->multipartField("metadata[$key]", $value);
            }
        }

        return $payload;
    }

    public function multipartField(string $name, mixed $contents): array
    {
        return [
            'name' => $name,
            'contents' => $contents,
        ];
    }

    public function multipartFile(string $name, string $path, string $filename): array
    {
        return [
            'name' => $name,
            'contents' => fopen($path, 'r'),
            'filename' => $filename,
        ];
    }

    private function userPayload(): array
    {
        return [
            'name' => $this->user?->name,
            'email' => $this->user?->email,
            'id' => $this->user?->getAuthIdentifier(),
            'environment' => config('app.env'),
            'url' => config('app.url'),
        ];
    }

    private function metadataPayload(): array
    {
        return [
            'url' => config('app.url'),
            'environment' => config('app.env'),
        ];
    }
}
