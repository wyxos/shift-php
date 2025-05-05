<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/shift', function () {
        return view('shift::dashboard');
    });

    Route::get('/shift/tasks', function () {
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->get($baseUrl . '/api/tasks');

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch tasks'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch tasks: ' . $e->getMessage()], 500);
        }
    })->name('shift.tasks.index');

    Route::post('/shift/tasks', function () {
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->post($baseUrl . '/api/tasks', [
                    ...request()->all(),
                    'project_id' => config('shift.project_id'),
                    'user_id' => auth()->id(), // project user ID
                    'user_email' => auth()->user()->email,
                    'user_name' => auth()->user()->name,
                ]);

            if ($response->successful()) {
                return response()->json(['message' => 'Task created successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to create task'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to create task: ' . $e->getMessage()], 500);
        }
    })->name('shift.tasks.store');

    Route::put('/shift/tasks/{id}', function ($id) {
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->put($baseUrl . '/api/tasks/' . $id, request()->all());

            if ($response->successful()) {
                return response()->json(['message' => 'Task updated successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to update task'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to update task: ' . $e->getMessage()], 500);
        }
    })->name('shift.tasks.update');
});

