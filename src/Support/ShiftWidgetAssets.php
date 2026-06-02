<?php

namespace Wyxos\Shift\Support;

use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;

class ShiftWidgetAssets
{
    public function tags(): string
    {
        $scriptUrl = trim((string) config('shift.widget.assets.script_url', ''));

        if ($scriptUrl !== '') {
            return $this->scriptTag($scriptUrl);
        }

        if ($this->shouldUseDevServer()) {
            $devUrl = rtrim($this->devServerUrl(), '/');

            return implode("\n", [
                $this->scriptTag($devUrl.'/@vite/client'),
                $this->scriptTag($devUrl.'/'.ltrim((string) config('shift.widget.assets.entry', 'src/widget.ts'), '/')),
            ]);
        }

        $entry = $this->manifestEntry();

        if ($entry === null) {
            return '';
        }

        $tags = collect($entry['css'] ?? [])
            ->filter(fn ($path) => is_string($path) && $path !== '')
            ->map(fn (string $path) => $this->styleTag($this->publicAssetUrl($path)))
            ->all();

        if (isset($entry['file']) && is_string($entry['file']) && $entry['file'] !== '') {
            $tags[] = $this->scriptTag($this->publicAssetUrl($entry['file']));
        }

        return implode("\n", $tags);
    }

    private function shouldUseDevServer(): bool
    {
        if (! App::environment('local') || ! (bool) config('shift.widget.assets.vite_dev_server.enabled', true)) {
            return false;
        }

        try {
            return Http::timeout(1)->head($this->devServerUrl())->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    private function devServerUrl(): string
    {
        $configuredUrl = trim((string) config('shift.widget.assets.vite_dev_server.url', ''));

        if ($configuredUrl !== '') {
            return $configuredUrl;
        }

        $host = config('shift.widget.assets.vite_dev_server.host') ?: config('app.domain', 'shift-sdk-package.test');
        $port = config('shift.widget.assets.vite_dev_server.port', 5174);

        return "https://{$host}:{$port}";
    }

    private function manifestEntry(): ?array
    {
        $manifestPath = public_path(ltrim((string) config('shift.widget.assets.manifest_path', 'shift-assets/.vite/manifest.json'), '/'));

        if (! is_file($manifestPath)) {
            return null;
        }

        $manifest = json_decode((string) file_get_contents($manifestPath), true);
        $entry = (string) config('shift.widget.assets.entry', 'src/widget.ts');

        if (! is_array($manifest) || ! isset($manifest[$entry]) || ! is_array($manifest[$entry])) {
            return null;
        }

        return $manifest[$entry];
    }

    private function publicAssetUrl(string $path): string
    {
        $basePath = trim((string) config('shift.widget.assets.base_path', 'shift-assets'), '/');

        return asset($basePath.'/'.ltrim($path, '/'));
    }

    private function scriptTag(string $url): string
    {
        return '<script type="module" src="'.$this->escape($url).'"></script>';
    }

    private function styleTag(string $url): string
    {
        return '<link rel="stylesheet" href="'.$this->escape($url).'">';
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
