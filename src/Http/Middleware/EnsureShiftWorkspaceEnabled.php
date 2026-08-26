<?php

namespace Wyxos\Shift\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureShiftWorkspaceEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('shift.workspace.enabled', true), 404);

        return $next($request);
    }
}
