<?php

namespace Wyxos\Shift;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskCollaboratorAdded extends Notification
{
    use Queueable;

    public function __construct(public array $data)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = $this->data['url'] ?? route('shift.dashboard').'/tasks?task='.$this->data['task_id'];

        return (new MailMessage)
            ->subject('You were added to a SHIFT task')
            ->line('You have been added as a collaborator on an existing task.')
            ->line('View the task to see the details.')
            ->action('View Task', $url)
            ->line('Please do not reply to this email directly.');
    }

    public function toArray(object $notifiable): array
    {
        return [];
    }
}
