<?php

namespace Wyxos\Shift\Support;

class ShiftUiError
{
    public function clean(string $value): string
    {
        return preg_replace_callback('~https?://[^\s)]+~', function (array $match): string {
            return preg_replace('~[?#][^\s]*~', '', $match[0]) ?? $match[0];
        }, $value) ?? $value;
    }

    /** @return array<int, array<string, mixed>> */
    public function frames(string $stack): array
    {
        $frames = [];
        foreach (array_slice(explode("\n", $stack), 0, 100) as $line) {
            if (! preg_match('~([^\s()]+):(\d+):(\d+)\)?$~', trim($line), $match)) {
                continue;
            }

            $file = $match[1];
            if (str_contains($file, '@')) {
                $file = substr($file, strrpos($file, '@') + 1);
            }
            if (str_starts_with($file, 'http://') || str_starts_with($file, 'https://')) {
                $file = parse_url($file, PHP_URL_PATH) ?: '/';
            }

            preg_match('~^(?:\s*at\s+([^()]+)\s+\(|([^@]+)@)~', $line, $function);
            $frames[] = [
                'file' => mb_substr($file, 0, 2048),
                'line' => (int) $match[2],
                'column' => (int) $match[3],
                'function' => isset($function[1]) || isset($function[2]) ? trim($function[1] ?: $function[2]) : null,
                'in_app' => str_contains($file, '/shift-assets/'),
            ];
        }

        return $frames;
    }
}
