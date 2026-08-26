<?php

namespace Wyxos\Shift\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

class HandleShiftAuthentication
{
    public function handle(Request $request, Closure $next): Response
    {
        $guards = $this->authenticationGuards();

        if (! Route::has('login') && $guards !== null && ! $this->authenticated($guards)) {
            return $this->unauthenticated($request, new AuthenticationException);
        }

        try {
            return $next($request);
        } catch (AuthenticationException $exception) {
            return $this->unauthenticated($request, $exception);
        }
    }

    /**
     * @return array<int, string|null>|null
     */
    private function authenticationGuards(): ?array
    {
        foreach ((array) config('shift.routes.middleware') as $middleware) {
            $middleware = (string) $middleware;

            if ($middleware === 'auth' || $middleware === Authenticate::class) {
                return [null];
            }

            foreach (['auth:', Authenticate::class.':'] as $prefix) {
                if (str_starts_with($middleware, $prefix)) {
                    return explode(',', substr($middleware, strlen($prefix)));
                }
            }
        }

        return null;
    }

    /**
     * @param  array<int, string|null>  $guards
     */
    private function authenticated(array $guards): bool
    {
        foreach ($guards as $guard) {
            if (Auth::guard($guard ?: null)->check()) {
                return true;
            }
        }

        return false;
    }

    private function unauthenticated(Request $request, \Throwable $exception): Response
    {
        if ($request->is('shift/api/*')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! Route::has('login')) {
            return response('Unauthenticated.', 401);
        }

        throw $exception;
    }
}
