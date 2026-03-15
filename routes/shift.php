<?php

use Illuminate\Support\Facades\Route;
use Wyxos\Shift\Http\Controllers\ShiftAiController;
use Wyxos\Shift\Http\Controllers\ShiftAttachmentController;
use Wyxos\Shift\Http\Controllers\ShiftCollaboratorController;
use Wyxos\Shift\Http\Controllers\ShiftController;
use Wyxos\Shift\Http\Controllers\ShiftDashboardController;
use Wyxos\Shift\Http\Controllers\ShiftNotificationController;
use Wyxos\Shift\Http\Controllers\ShiftTaskController;
use Wyxos\Shift\Http\Controllers\ShiftTaskThreadController;

Route::post('/shift/api/notifications', [ShiftNotificationController::class, 'store']);
Route::get('/shift/api/collaborators/external', [ShiftCollaboratorController::class, 'external']);

Route::middleware(config('shift.routes.middleware'))->group(function () {
    // Task routes
    Route::get('/shift/api/dashboard', [ShiftDashboardController::class, 'index'])->name('dashboard.index');
    Route::get('/shift/api/tasks', [ShiftTaskController::class, 'index'])->name('tasks.index');
    Route::get('/shift/api/task-collaborators', [ShiftCollaboratorController::class, 'task'])->name('task-collaborators.index');
    Route::get('/shift/api/tasks/{id}', [ShiftTaskController::class, 'show'])->name('tasks.show');
    Route::post('/shift/api/tasks', [ShiftTaskController::class, 'store'])->name('tasks.store');
    Route::put('/shift/api/tasks/{id}', [ShiftTaskController::class, 'update'])->name('tasks.update');
    Route::patch('/shift/api/tasks/{id}/collaborators', [ShiftTaskController::class, 'updateCollaborators'])->name('tasks.collaborators.update');
    Route::patch('/shift/api/tasks/{id}/toggle-status', [ShiftTaskController::class, 'toggleStatus'])->name('tasks.toggle-status');
    Route::delete('/shift/api/tasks/{id}', [ShiftTaskController::class, 'destroy'])->name('tasks.destroy');

    // Task thread routes
    Route::get('/shift/api/tasks/{taskId}/threads', [ShiftTaskThreadController::class, 'index'])->name('task-threads.index');
    Route::post('/shift/api/tasks/{taskId}/threads', [ShiftTaskThreadController::class, 'store'])->name('task-threads.store');
    Route::get('/shift/api/tasks/{taskId}/threads/{threadId}', [ShiftTaskThreadController::class, 'show'])->name('task-threads.show');
    Route::put('/shift/api/tasks/{taskId}/threads/{threadId}', [ShiftTaskThreadController::class, 'update'])->name('task-threads.update');
    Route::delete('/shift/api/tasks/{taskId}/threads/{threadId}', [ShiftTaskThreadController::class, 'destroy'])->name('task-threads.destroy');

    // Attachment routes
    Route::post('/shift/api/attachments/upload', [ShiftAttachmentController::class, 'upload'])->name('attachments.upload');
    Route::post('/shift/api/attachments/upload-init', [ShiftAttachmentController::class, 'uploadInit'])->name('attachments.upload-init');
    Route::get('/shift/api/attachments/upload-status', [ShiftAttachmentController::class, 'uploadStatus'])->name('attachments.upload-status');
    Route::post('/shift/api/attachments/upload-chunk', [ShiftAttachmentController::class, 'uploadChunk'])->name('attachments.upload-chunk');
    Route::post('/shift/api/attachments/upload-complete', [ShiftAttachmentController::class, 'uploadComplete'])->name('attachments.upload-complete');
    Route::post('/shift/api/attachments/upload-multiple', [ShiftAttachmentController::class, 'uploadMultiple'])->name('attachments.upload-multiple');
    Route::delete('/shift/api/attachments/remove-temp', [ShiftAttachmentController::class, 'removeTemp'])->name('attachments.remove-temp');
    Route::get('/shift/api/attachments/list-temp', [ShiftAttachmentController::class, 'listTemp'])->name('attachments.list-temp');
    Route::get('/shift/api/attachments/temp/{temp}/{filename}', [ShiftAttachmentController::class, 'showTemp'])->name('attachments.temp');
    Route::get('/shift/api/attachments/{attachment}/download', [ShiftAttachmentController::class, 'download'])->name('attachments.download');
    Route::post('/shift/api/ai/improve', [ShiftAiController::class, 'improve'])->name('ai.improve');

    Route::get('/shift/{page?}', [ShiftController::class, 'index'])
        ->name('shift.dashboard')
        ->where('page', '.*');
});
