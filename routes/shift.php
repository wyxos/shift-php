<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/shift', function () {
//        $token = config('shift.api_token');
//        $baseUrl = config('shift.url');
//
//        $tasks = Http::withToken($token)
//            ->acceptJson()
//            ->get($baseUrl . '/api/tasks', request()->query())
//            ->json();
//
//        return Inertia::render('shift/Shift', [
//            'tasks' => $tasks
//        ]);.

        return view('shift::Dashboard');
    });

    Route::post('/shift/tasks', function () {
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->post($baseUrl . '/api/tasks', request()->all());

            if ($response->successful()) {
                return back()->with('success', 'Task created successfully');
            }

            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to create task']);
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to create task: ' . $e->getMessage()]);
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
                return back()->with('success', 'Task updated successfully');
            }

            return back()->withErrors(['error' => $response->json()['message'] ?? 'Failed to update task']);
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to update task: ' . $e->getMessage()]);
        }
    })->name('shift.tasks.update');
});

