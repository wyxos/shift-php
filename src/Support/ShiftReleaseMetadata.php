<?php

namespace Wyxos\Shift\Support;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

final class ShiftReleaseMetadata
{
    /**
     * @var array<int, string>
     */
    private const REVISION_ENV_KEYS = [
        'HERD_DEPLOYMENT_COMMIT',
        'SOURCE_VERSION',
        'SOURCE_COMMIT',
        'GITHUB_SHA',
        'VERCEL_GIT_COMMIT_SHA',
        'RENDER_GIT_COMMIT',
        'COMMIT_SHA',
    ];

    public function __construct(
        private readonly ?string $basePath = null,
    ) {}

    public function release(): ?string
    {
        $revision = $this->revision();

        if ($revision === null) {
            return null;
        }

        return $this->exactGitTag($revision);
    }

    public function revision(): ?string
    {
        return $this->gitHeadRevision() ?? $this->deploymentRevision();
    }

    private function deploymentRevision(): ?string
    {
        foreach (self::REVISION_ENV_KEYS as $key) {
            $value = $this->filled($this->environment($key));
            $revision = $this->validSha($value);

            if ($revision !== null) {
                return $revision;
            }
        }

        return null;
    }

    private function gitHeadRevision(): ?string
    {
        $gitDirectory = $this->gitDirectory();

        if ($gitDirectory === null) {
            return null;
        }

        $head = $this->readFile($gitDirectory.'/HEAD');

        if ($head === null) {
            return null;
        }

        if (! str_starts_with($head, 'ref: ')) {
            return $this->validSha($head);
        }

        $ref = trim(substr($head, 5));
        $revision = $this->readFile($gitDirectory.'/'.$ref)
            ?? $this->packedRef($gitDirectory, $ref);

        return $this->validSha($revision);
    }

    private function exactGitTag(string $revision): ?string
    {
        $gitDirectory = $this->gitDirectory();

        if ($gitDirectory === null) {
            return null;
        }

        $tags = [
            ...$this->looseTags($gitDirectory, $revision),
            ...$this->packedTags($gitDirectory, $revision),
        ];

        $tags = array_values(array_unique($tags));
        sort($tags, SORT_NATURAL);

        return $tags[0] ?? null;
    }

    /**
     * @return array<int, string>
     */
    private function looseTags(string $gitDirectory, string $revision): array
    {
        $tagsDirectory = $gitDirectory.'/refs/tags';

        if (! is_dir($tagsDirectory)) {
            return [];
        }

        $tags = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tagsDirectory));

        foreach ($iterator as $file) {
            if (! $file instanceof SplFileInfo || ! $file->isFile()) {
                continue;
            }

            if ($this->readFile($file->getPathname()) !== $revision) {
                continue;
            }

            $tags[] = trim(str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($tagsDirectory))), '/');
        }

        return $tags;
    }

    /**
     * @return array<int, string>
     */
    private function packedTags(string $gitDirectory, string $revision): array
    {
        $packedRefs = $this->readLines($gitDirectory.'/packed-refs');

        if ($packedRefs === []) {
            return [];
        }

        $tags = [];
        $previousTag = null;

        foreach ($packedRefs as $line) {
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (str_starts_with($line, '^')) {
                if (substr($line, 1) === $revision && $previousTag !== null) {
                    $tags[] = $previousTag;
                }

                continue;
            }

            [$sha, $ref] = array_pad(explode(' ', $line, 2), 2, null);
            $previousTag = str_starts_with((string) $ref, 'refs/tags/')
                ? substr((string) $ref, strlen('refs/tags/'))
                : null;

            if ($sha === $revision && $previousTag !== null) {
                $tags[] = $previousTag;
            }
        }

        return $tags;
    }

    private function packedRef(string $gitDirectory, string $targetRef): ?string
    {
        foreach ($this->readLines($gitDirectory.'/packed-refs') as $line) {
            if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, '^')) {
                continue;
            }

            [$sha, $ref] = array_pad(explode(' ', $line, 2), 2, null);

            if ($ref === $targetRef) {
                return $sha;
            }
        }

        return null;
    }

    private function gitDirectory(): ?string
    {
        $gitPath = $this->appBasePath().'/.git';

        if (is_dir($gitPath)) {
            return $gitPath;
        }

        if (! is_file($gitPath)) {
            return null;
        }

        $gitFile = $this->readFile($gitPath);

        if ($gitFile === null || ! str_starts_with($gitFile, 'gitdir:')) {
            return null;
        }

        $gitDirectory = trim(substr($gitFile, strlen('gitdir:')));

        if ($gitDirectory === '') {
            return null;
        }

        if (! str_starts_with($gitDirectory, '/')) {
            $gitDirectory = $this->appBasePath().'/'.$gitDirectory;
        }

        return is_dir($gitDirectory) ? $gitDirectory : null;
    }

    private function appBasePath(): string
    {
        if ($this->basePath !== null) {
            return rtrim($this->basePath, '/');
        }

        if (function_exists('base_path')) {
            return rtrim(base_path(), '/');
        }

        return rtrim((string) getcwd(), '/');
    }

    private function readFile(string $path): ?string
    {
        if (! is_file($path) || ! is_readable($path)) {
            return null;
        }

        $contents = file_get_contents($path);

        if ($contents === false) {
            return null;
        }

        return trim($contents);
    }

    /**
     * @return array<int, string>
     */
    private function readLines(string $path): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            return [];
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        return $lines === false ? [] : $lines;
    }

    private function environment(string $key): ?string
    {
        if (isset($_ENV[$key]) && is_scalar($_ENV[$key])) {
            return (string) $_ENV[$key];
        }

        if (isset($_SERVER[$key]) && is_scalar($_SERVER[$key])) {
            return (string) $_SERVER[$key];
        }

        $value = getenv($key);

        return $value === false ? null : $value;
    }

    private function validSha(?string $value): ?string
    {
        $value = $this->filled($value);

        if ($value === null) {
            return null;
        }

        return preg_match('/^[0-9a-f]{40}$/i', $value) === 1 ? strtolower($value) : null;
    }

    private function filled(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
