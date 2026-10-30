<?php

namespace Wyxos\Shift\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;
use Wyxos\Shift\Support\ShiftErrorReporter;

class ReportShiftErrors
{
    public function handle(Request $request, Closure $next): Response
    {
        $correlation = $request->header('X-Shift-Correlation-ID');
        $request->attributes->set('shift.error_correlation_id', is_string($correlation) && Str::isUuid($correlation) ? $correlation : (string) Str::uuid());
        $request->attributes->remove('shift.error_reported');

        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            if (! $request->routeIs('shift.errors.store')) {
                app(ShiftErrorReporter::class)->reportSdkThrowable($exception, $request->route()?->getActionName() ?? 'workspace');
            }

            throw $exception;
        }

        $response->headers->set('X-Shift-Correlation-ID', $request->attributes->get('shift.error_correlation_id'));
        if ($request->attributes->get('shift.error_reported')) {
            $response->headers->set('X-Shift-Error-Reported', 'true');
        }

        return $response;
    }
}
