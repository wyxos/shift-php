<?php

namespace Wyxos\Shift;

use Illuminate\Support\Facades\Route;
use Shift\Core\Notifications\TaskThreadUpdated as CoreTaskThreadUpdated;

class TaskThreadUpdated extends CoreTaskThreadUpdated
{
    /**
     * Create a new notification instance.
     */
    public function __construct(public array $data)
    {
        //  request('type'),
        //                request('task_id'),
        //                request('thread_id'),
        //                request('content'),
        //                request('created_at')
    }

    protected function resolveUrl(): ?string
    {
        if (! empty($this->data['url'])) {
            return $this->data['url'];
        }

        if (Route::has('shift.dashboard')) {
            return route('shift.dashboard').'/tasks-v2?task='.$this->data['task_id'];
        }

        return null;
    }
}
