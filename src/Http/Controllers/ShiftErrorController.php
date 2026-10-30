<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Symfony\Component\HttpFoundation\Response;
use Wyxos\Shift\Support\ShiftErrorReporter;

class ShiftErrorController extends Controller
{
    public function store(Request $request, ShiftErrorReporter $reporter): Response
    {
        abort_unless($request->user() !== null, 401);

        if (! (bool) config('shift.errors.enabled', true)) {
            return response()->noContent();
        }

        $attributes = $request->validate([
            'error' => ['required', 'array:name,message'],
            'error.name' => ['required', 'string', 'max:512'],
            'error.message' => ['required', 'string', 'max:20000'],
            'stack' => ['nullable', 'string', 'max:20000'],
            'context' => ['sometimes', 'array:operation,route,component,http_status,correlation_id'],
            'context.operation' => ['nullable', 'string', 'max:255'],
            'context.route' => ['nullable', 'string', 'max:2048', 'regex:~^/shift(?:/[^?#]*)?$~'],
            'context.component' => ['nullable', 'string', 'max:255'],
            'context.http_status' => ['nullable', 'integer', 'between:0,599'],
            'context.correlation_id' => ['nullable', 'uuid'],
        ]);

        return $reporter->reportUiError($attributes)
            ? response()->noContent()
            : response()->json(['message' => 'Error report could not be delivered.'], 503);
    }
}
