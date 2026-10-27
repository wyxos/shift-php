<?php

namespace Wyxos\Shift\Support;

use DirectoryIterator;
use Illuminate\Filesystem\Filesystem;
use RuntimeException;

class ShiftAssetPermissions
{
    public function __construct(private readonly Filesystem $files) {}

    public function normalize(string $directory): void
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return;
        }

        if (is_link($directory)) {
            throw new RuntimeException("Cannot set SHIFT asset permissions through a symbolic link: [{$directory}].");
        }

        if (! is_dir($directory)) {
            throw new RuntimeException("Published SHIFT asset directory is missing: [{$directory}].");
        }

        $this->setPermissions($directory, 0755);

        foreach (new DirectoryIterator($directory) as $entry) {
            if ($entry->isDot()) {
                continue;
            }

            $path = $entry->getPathname();

            if ($entry->isLink()) {
                throw new RuntimeException("Cannot set SHIFT asset permissions through a symbolic link: [{$path}].");
            }

            if ($entry->isDir()) {
                $this->normalize($path);
            } elseif ($entry->isFile()) {
                $this->setPermissions($path, 0644);
            } else {
                throw new RuntimeException("Unsupported published SHIFT asset: [{$path}].");
            }
        }
    }

    private function setPermissions(string $path, int $permissions): void
    {
        if (! @$this->files->chmod($path, $permissions)) {
            throw new RuntimeException("Unable to set SHIFT asset permissions on [{$path}]. Check file ownership and publish again.");
        }
    }
}
