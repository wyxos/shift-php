<?php

namespace Wyxos\Shift\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Wyxos\Shift\Support\ShiftWidgetAssets;
use Wyxos\Shift\Support\ShiftWidgetPortalClient;

class InjectShiftWidget
{
    public function __construct(
        private readonly ShiftWidgetPortalClient $portalClient,
        private readonly ShiftWidgetAssets $assets,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->shouldInspect($request, $response)) {
            return $response;
        }

        if (! (bool) config('shift.widget.enabled', false)) {
            return $response;
        }

        try {
            $portalConfig = $this->portalClient->widgetConfiguration();
        } catch (\Throwable) {
            return $response;
        }

        if (! $portalConfig['widget_enabled']) {
            return $response;
        }

        $user = Auth::guard($this->guardName())->user();

        if (! $portalConfig['guest_submissions_enabled'] && ! $user) {
            return $response;
        }

        $assetTags = $this->assets->tags();

        if ($assetTags === '') {
            return $response;
        }

        $html = $response->getContent();

        if (! is_string($html) || str_contains($html, 'id="shift-widget-loader"')) {
            return $response;
        }

        $loader = $this->loaderScript($portalConfig, (bool) $user)."\n".$assetTags;
        $count = 0;
        $html = preg_replace('/<\/body\s*>/i', $loader."\n</body>", $html, 1, $count);

        if ($count === 0) {
            $html .= "\n".$loader;
        }

        $response->setContent($html);

        return $response;
    }

    private function shouldInspect(Request $request, Response $response): bool
    {
        if (! method_exists($response, 'getContent') || ! method_exists($response, 'setContent')) {
            return false;
        }

        if ($request->is('shift') || $request->is('shift/*')) {
            return false;
        }

        if ($request->expectsJson() || $request->isJson() || $response->isRedirection()) {
            return false;
        }

        $contentType = strtolower((string) $response->headers->get('Content-Type', ''));

        if (str_contains($contentType, 'text/html')) {
            return true;
        }

        if ($contentType !== '') {
            return false;
        }

        $content = $response->getContent();

        return is_string($content) && str_contains(strtolower(substr($content, 0, 2048)), '<html');
    }

    /**
     * @param  array{widget_enabled: bool, guest_submissions_enabled: bool}  $portalConfig
     */
    private function loaderScript(array $portalConfig, bool $authenticated): string
    {
        $runtimeConfig = [
            'endpoints' => [
                'config' => '/shift/api/widget/config',
                'tasks' => '/shift/api/widget/tasks',
                'sessionUser' => '/shift/api/widget/session-user',
                'login' => '/shift/api/widget/login',
            ],
            'csrfToken' => csrf_token(),
            'guestSubmissionsEnabled' => $portalConfig['guest_submissions_enabled'],
            'authenticated' => $authenticated,
            'loginCredentialField' => $this->credentialField(),
            'appName' => (string) config('app.name', 'Application'),
        ];

        $json = json_encode($runtimeConfig, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

        return <<<HTML
<script id="shift-widget-loader">
    window.shiftWidgetConfig = {$json};
</script>
HTML;
    }

    private function guardName(): string
    {
        return (string) (config('shift.widget.auth.guard') ?: config('auth.defaults.guard', 'web'));
    }

    private function credentialField(): string
    {
        $field = trim((string) config('shift.widget.login.credential_field', 'email'));

        return $field !== '' ? $field : 'email';
    }
}
