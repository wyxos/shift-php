<?php

use Illuminate\Support\Facades\Route;
use Wyxos\Shift\Http\Controllers\ShiftController;
use Wyxos\Shift\Http\Controllers\ShiftTaskController;
use Wyxos\Shift\Http\Controllers\ShiftTaskThreadController;
use Wyxos\Shift\Http\Controllers\ShiftAttachmentController;
use Wyxos\Shift\Http\Controllers\ShiftNotificationController;

Route::post('/shift/api/notifications', [ShiftNotificationController::class, 'store']);

Route::middleware(config('shift.routes.middleware'))->group(function () {
    // Task routes
    Route::get('/shift/api/tasks', [ShiftTaskController::class, 'index'])->name('tasks.index');
    Route::get('/shift/api/tasks/{id}', [ShiftTaskController::class, 'show'])->name('tasks.show');
    Route::post('/shift/api/tasks', [ShiftTaskController::class, 'store'])->name('tasks.store');
    Route::put('/shift/api/tasks/{id}', [ShiftTaskController::class, 'update'])->name('tasks.update');
    Route::delete('/shift/api/tasks/{id}', [ShiftTaskController::class, 'destroy'])->name('tasks.destroy');

    // Task thread routes
    Route::get('/shift/api/tasks/{taskId}/threads', [ShiftTaskThreadController::class, 'index'])->name('task-threads.index');
    Route::post('/shift/api/tasks/{taskId}/threads', [ShiftTaskThreadController::class, 'store'])->name('task-threads.store');
    Route::get('/shift/api/tasks/{taskId}/threads/{threadId}', [ShiftTaskThreadController::class, 'show'])->name('task-threads.show');

    // Attachment routes
    Route::post('/shift/api/attachments/upload', [ShiftAttachmentController::class, 'upload'])->name('attachments.upload');
    Route::post('/shift/api/attachments/upload-multiple', [ShiftAttachmentController::class, 'uploadMultiple'])->name('attachments.upload-multiple');
    Route::delete('/shift/api/attachments/remove-temp', [ShiftAttachmentController::class, 'removeTemp'])->name('attachments.remove-temp');
    Route::get('/shift/api/attachments/list-temp', [ShiftAttachmentController::class, 'listTemp'])->name('attachments.list-temp');
    Route::get('/shift/api/attachments/{attachment}/download', [ShiftAttachmentController::class, 'download'])->name('attachments.download');

    Route::get('/shift/{page?}', [ShiftController::class, 'index'])
        ->name('shift.dashboard')
        ->where('page', '.*');
});
