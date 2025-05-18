<?php

use Illuminate\Support\Facades\Route;
use Wyxos\Shift\Http\Controllers\ShiftController;
use Wyxos\Shift\Http\Controllers\TaskController;

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/shift', [ShiftController::class, 'index']);

    Route::get('/shift/api/tasks', [TaskController::class, 'index'])->name('shift.tasks.index');
    Route::get('/shift/api/tasks/{id}', [TaskController::class, 'show'])->name('shift.tasks.show');
    Route::post('/shift/api/tasks', [TaskController::class, 'store'])->name('shift.tasks.store');
    Route::put('/shift/api/tasks/{id}', [TaskController::class, 'update'])->name('shift.tasks.update');
});
