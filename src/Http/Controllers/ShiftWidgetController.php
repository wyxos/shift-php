<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Wyxos\Shift\Support\ShiftWidgetPortalClient;

class ShiftWidgetController extends Controller
{
    public function __construct(private readonly ShiftWidgetPortalClient $portalClient) {}

    public function config(): JsonResponse
    {
        if (! (bool) config('shift.widget.enabled', false)) {
            return response()->json($this->configPayload([
                'widget_enabled' => false,
                'guest_submissions_enabled' => false,
            ]));
        }

        try {
            $portalConfig = $this->portalClient->widgetConfiguration();
        } catch (\Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], $this->statusCode($exception, 500));
        }

        return response()->json($this->configPayload($portalConfig));
    }

    public function sessionUser(): JsonResponse
    {
        $user = $this->guard()->user();

        return response()->json([
            'authenticated' => (bool) $user,
            'user' => $user ? $this->userPayload($user) : null,
        ]);
    }

    public function login(Request $request): Response
    {
        $handler = config('shift.widget.login.handler');

        if ($handler) {
            return $this->customLogin($request, $handler);
        }

        $credentialField = $this->credentialField();
        $credential = $request->input($credentialField, $request->input('credential'));

        $request->merge([$credentialField => $credential]);

        $attributes = $request->validate([
            $credentialField => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $credentials = [
            $credentialField => $attributes[$credentialField],
            'password' => $attributes['password'],
        ];

        if (! $this->guard()->attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                $credentialField => 'These credentials do not match our records.',
            ]);
        }

        $request->session()->regenerate();

        return $this->authenticatedResponse($this->guard()->user());
    }

    public function store(Request $request): JsonResponse
    {
        if (! (bool) config('shift.widget.enabled', false)) {
            return response()->json(['message' => 'SHIFT widget is disabled.'], 403);
        }

        try {
            $portalConfig = $this->portalClient->widgetConfiguration();
        } catch (\Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], $this->statusCode($exception, 500));
        }

        if (! $portalConfig['widget_enabled']) {
            return response()->json(['message' => 'SHIFT widget is disabled.'], 403);
        }

        $sessionUser = $this->guard()->user();

        if (! $portalConfig['guest_submissions_enabled'] && ! $sessionUser) {
            return response()->json(['message' => 'Authentication is required to submit this report.'], 401);
        }

        $attributes = $request->validate([
            'kind' => ['required', 'string', 'in:task,feature,issue'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'anonymous' => ['sometimes', 'boolean'],
            'metadata' => ['nullable', 'array'],
            'user' => ['nullable', 'array'],
            'user.name' => ['nullable', 'string', 'max:255'],
            'user.email' => ['nullable', 'email', 'max:255'],
        ]);

        $anonymous = $request->boolean('anonymous');
        $payload = [
            'kind' => $attributes['kind'],
            'title' => $attributes['title'],
            'description' => $attributes['description'],
            'anonymous' => $anonymous,
            'metadata' => $this->metadataPayload($attributes['metadata'] ?? []),
        ];

        if (! $anonymous) {
            if ($sessionUser) {
                $payload['user'] = $this->userPayload($sessionUser);
            } elseif (isset($attributes['user']) && is_array($attributes['user'])) {
                $payload['user'] = $this->guestUserPayload($attributes['user']);
            }
        }

        $response = $this->portalClient->submitWidgetTask($payload);

        return response()->json($response->json() ?? [], $response->status());
    }

    /**
     * @param  array{widget_enabled: bool, guest_submissions_enabled: bool}  $portalConfig
     */
    private function configPayload(array $portalConfig): array
    {
        $user = $this->guard()->user();

        return [
            'widget_enabled' => (bool) $portalConfig['widget_enabled'],
            'guest_submissions_enabled' => (bool) $portalConfig['guest_submissions_enabled'],
            'authenticated' => (bool) $user,
            'requires_authentication' => $portalConfig['widget_enabled'] && ! $portalConfig['guest_submissions_enabled'] && ! $user,
            'login_credential_field' => $this->credentialField(),
        ];
    }

    private function customLogin(Request $request, mixed $handler): Response
    {
        $result = $this->callLoginHandler($handler, $request);

        if ($result instanceof Response) {
            return $result;
        }

        if ($result instanceof Authenticatable) {
            $this->guard()->login($result);
            $request->session()->regenerate();

            return $this->authenticatedResponse($result);
        }

        if (is_array($result)) {
            return response()->json($result);
        }

        if ($result === true && ($user = $this->guard()->user())) {
            $request->session()->regenerate();

            return $this->authenticatedResponse($user);
        }

        throw ValidationException::withMessages([
            $this->credentialField() => 'These credentials do not match our records.',
        ]);
    }

    private function callLoginHandler(mixed $handler, Request $request): mixed
    {
        if (is_string($handler) && str_contains($handler, '@')) {
            [$class, $method] = explode('@', $handler, 2);

            return app($class)->{$method}($request, $this->guardName(), $this->credentialField());
        }

        if (is_string($handler)) {
            $handler = app($handler);
        }

        if (is_callable($handler)) {
            return $handler($request, $this->guardName(), $this->credentialField());
        }

        throw ValidationException::withMessages([
            $this->credentialField() => 'The configured SHIFT widget login handler is not callable.',
        ]);
    }

    private function authenticatedResponse(?Authenticatable $user): JsonResponse
    {
        if (! $user) {
            throw ValidationException::withMessages([
                $this->credentialField() => 'These credentials do not match our records.',
            ]);
        }

        return response()->json([
            'authenticated' => true,
            'csrf_token' => csrf_token(),
            'user' => $this->userPayload($user),
        ]);
    }

    private function userPayload(Authenticatable $user): array
    {
        return [
            'id' => $user->getAuthIdentifier(),
            'name' => data_get($user, 'name'),
            'email' => data_get($user, 'email'),
            'environment' => (string) config('app.env'),
            'url' => (string) config('app.url'),
            'authenticated' => true,
        ];
    }

    private function guestUserPayload(array $user): array
    {
        return collect([
            'name' => $user['name'] ?? null,
            'email' => $user['email'] ?? null,
            'authenticated' => false,
        ])->filter(fn ($value) => filled($value))->all();
    }

    private function metadataPayload(array $metadata): array
    {
        return [
            'url' => $metadata['url'] ?? $metadata['page_url'] ?? config('app.url'),
            'environment' => (string) config('app.env'),
            ...$metadata,
            'source' => 'shift-php-widget',
            'consumer_app' => [
                'name' => (string) config('app.name', 'Application'),
                'environment' => (string) config('app.env'),
                'url' => (string) config('app.url'),
            ],
        ];
    }

    private function guard()
    {
        return Auth::guard($this->guardName());
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

    private function statusCode(\Throwable $exception, int $default): int
    {
        $code = $exception->getCode();

        return is_int($code) && $code >= 400 && $code < 600 ? $code : $default;
    }
}
