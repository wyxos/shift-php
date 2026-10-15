<?php

namespace Wyxos\Shift\Support;

use RuntimeException;

class InstallProjectPayload
{
    public function __construct(private readonly array $payload) {}

    public function projects(): array
    {
        $items = $this->listValue([
            'data.projects',
            'projects',
            'data',
        ]);

        $projects = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $project = $this->normalizeProjectItem($item);

            if ($project !== null) {
                $projects[] = $project;
            }
        }

        return $projects;
    }

    public function organisations(): ?array
    {
        $data = $this->pathValue('data');
        $hasNestedList = is_array($data) && array_key_exists('organisations', $data);
        $hasTopLevelList = array_key_exists('organisations', $this->payload);

        if (! $hasNestedList && ! $hasTopLevelList) {
            return null;
        }

        $items = $hasNestedList ? $data['organisations'] : $this->payload['organisations'];

        if (! is_array($items) || ! array_is_list($items)) {
            throw new RuntimeException('SHIFT returned an invalid list of manageable organisations. Project creation stopped.');
        }

        $organisations = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                throw new RuntimeException('SHIFT returned an invalid manageable organisation. Project creation stopped.');
            }

            $id = $this->stringValue($item, ['id']);
            $name = $this->stringValue($item, ['name']);

            if ($id === null || $name === null) {
                throw new RuntimeException('SHIFT returned an invalid manageable organisation. Project creation stopped.');
            }

            $organisations[] = ['id' => $id, 'name' => $name];
        }

        return $organisations;
    }

    public function project(): array
    {
        $item = $this->pathValue('data.project');

        if (! is_array($item)) {
            $item = $this->pathValue('project');
        }

        if (is_array($item)) {
            $project = $this->normalizeProjectItem($item);

            if ($project !== null) {
                return $project;
            }
        }

        $projects = $this->projects();

        if ($projects !== []) {
            return $projects[0];
        }

        throw new RuntimeException('SHIFT did not return a usable project for this install session.');
    }

    private function normalizeProjectItem(array $item): ?array
    {
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

        if ($label === '' && $id === null && $token === null) {
            return null;
        }

        return [
            'id' => $id ?? $token ?? $label,
            'token' => $token,
            'name' => $name ?? $label,
            'label' => $label,
            'organisation_id' => $this->stringValue($item, ['organisation_id', 'organisation.id']),
            'raw' => $item,
        ];
    }

    private function stringValue(array $payload, array $paths): ?string
    {
        foreach ($paths as $path) {
            $value = $this->valueAt($payload, $path);

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

    private function listValue(array $paths): array
    {
        foreach ($paths as $path) {
            $value = $this->pathValue($path);

            if (is_array($value) && array_is_list($value)) {
                return $value;
            }
        }

        return [];
    }

    private function pathValue(string $path): mixed
    {
        return $this->valueAt($this->payload, $path);
    }

    private function valueAt(array $payload, string $path): mixed
    {
        $value = $payload;

        foreach (explode('.', $path) as $segment) {
            if (! is_array($value) || ! array_key_exists($segment, $value)) {
                return null;
            }

            $value = $value[$segment];
        }

        return $value;
    }
}
