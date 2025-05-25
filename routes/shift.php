<?php

use Illuminate\Support\Facades\Route;
use Wyxos\Shift\Http\Controllers\ShiftController;
use Wyxos\Shift\Http\Controllers\ShiftTaskController;

Route::middleware(['web', 'auth'])->group(function () {

    Route::get('/shift/api/tasks', [ShiftTaskController::class, 'index'])->name('tasks.index');
    Route::get('/shift/api/tasks/{id}', [ShiftTaskController::class, 'show'])->name('tasks.show');
    Route::post('/shift/api/tasks', [ShiftTaskController::class, 'store'])->name('tasks.store');
    Route::put('/shift/api/tasks/{id}', [ShiftTaskController::class, 'update'])->name('tasks.update');
    Route::delete('/shift/api/tasks/{id}', [ShiftTaskController::class, 'destroy'])->name('tasks.destroy');

    Route::get('/shift/{page?}', [ShiftController::class, 'index'])
        ->name('shift.dashboard')
        ->where('page', '.*');
});
