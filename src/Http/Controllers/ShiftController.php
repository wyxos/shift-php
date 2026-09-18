<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

class ShiftController extends Controller
{
    /**
     * Display the shift dashboard.
     *
     * @return string|\Illuminate\Http\Response
     */
    public function index()
    {
        // In local development, proxy to the Vite dev server if it's running
        if (App::environment('local') && $this->isViteDevServerRunning()) {
            try {
                $response = Http::get($this->getViteDevServerUrl());

                if ($response->successful()) {
                    $html = $response->body();

                    $viteUrl = rtrim($this->getViteDevServerUrl(), '/');

                    $replacements = [
                        '"/@vite/client"' => "\"{$viteUrl}/@vite/client\"",
                        '"/src/' => "\"{$viteUrl}/src/",
                        "'/src/" => "'{$viteUrl}/src/",
                        "'/@vite/client'" => "'{$viteUrl}/@vite/client'",
                    ];

                    foreach ($replacements as $search => $replace) {
                        $html = str_replace($search, $replace, $html);
                    }

                    $html = $this->injectLoginRoute($html);

                    return response($html, 200)
                        ->header('Content-Type', 'text/html');
                }
            } catch (\Exception $e) {
                // If there's an error connecting to the Vite dev server, fall back to the built files
            }
        }

        // In production or if Vite dev server is not running, serve the built files
        $html = file_get_contents(public_path('/shift-assets/index.html'));
        $html = $this->injectLoginRoute($html);

        return $html;
    }

    /**
     * Check if the Vite dev server is running.
     *
     * @return bool
     */
    private function isViteDevServerRunning()
    {
        try {
            $response = Http::timeout(1)->head($this->getViteDevServerUrl());

            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get the URL of the Vite dev server.
     *
     * @return string
     */
    private function getViteDevServerUrl()
    {
        $host = config('app.domain', 'shift-sdk-package.test');
        $port = 5174; // Default Vite dev server port

        return "https://{$host}:{$port}/";
    }

    /**
     * Inject the login route URL into the HTML.
     */
    private function injectLoginRoute(string $html): string
    {
        $loginRoute = Route::has('login') ? route('login') : null;
        $logoutRoute = Route::has('logout') ? route('logout') : null;
        $baseUrl = config('app.url');
        $appName = config('app.name');
        $shiftUrl = $this->resolveShiftUrl();

        // Get authenticated user if available
        $user = auth()->user();
        $username = $user ? $user->name : null;
        $email = $user ? $user->email : null;
        $aiEnabled = (bool) config('shift.ai.enabled', false);

        $shiftConfig = json_encode([
            'loginRoute' => $loginRoute,
            'logoutRoute' => $logoutRoute,
            'baseUrl' => $baseUrl,
            'appName' => $appName,
            'username' => $username,
            'userId' => $user?->getAuthIdentifier(),
            'email' => $email,
            'aiEnabled' => $aiEnabled,
            'appEnvironment' => (string) config('app.env', 'production'),
            'shiftUrl' => $shiftUrl,
        ], JSON_UNESCAPED_SLASHES);

        $script = <<<SCRIPT
<script>
    window.shiftConfig = {$shiftConfig};
</script>
SCRIPT;

        $html = $this->injectShiftFavicon($html, $shiftUrl);

        // Inject just before the first <script type="module">
        $injected = preg_replace('/(<script\s+type="module")/i', $script."\n$1", $html, 1);

        return is_string($injected) ? $injected : $html;
    }

    private function resolveShiftUrl(): string
    {
        $url = rtrim((string) config('shift.url', 'https://shift.wyxos.com'), '/');

        return $url !== '' ? $url : 'https://shift.wyxos.com';
    }

    private function injectShiftFavicon(string $html, string $shiftUrl): string
    {
        $favicon = '<link rel="icon" type="image/svg+xml" href="'.e($shiftUrl.'/favicon.svg').'" />';
        $replaced = preg_replace('/<link\s+rel="icon"[^>]*>/i', $favicon, $html, 1);

        return is_string($replaced) ? $replaced : $html;
    }
}
