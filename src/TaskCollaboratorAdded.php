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
        $taskTitle = $this->data['task_title'] ?? 'Task #'.$this->data['task_id'];
        $taskStatus = ucfirst($this->data['task_status'] ?? 'pending');
        $taskPriority = ucfirst($this->data['task_priority'] ?? 'medium');
        $url = $this->data['url'] ?? route('shift.dashboard').'/tasks?task='.$this->data['task_id'];

        return (new MailMessage)
            ->subject("Task Access Granted: {$taskTitle}")
            ->line('You have been added as a collaborator on an existing task.')
            ->line("Task Title: {$taskTitle}")
            ->line("Priority: {$taskPriority}")
            ->line("Status: {$taskStatus}")
            ->when(! empty($this->data['task_description']), function ($message) {
                return $message->line('Description: '.$this->data['task_description']);
            })
            ->action('View Task', $url)
            ->line('Please do not reply to this email directly.');
    }

    public function toArray(object $notifiable): array
    {
        return [];
    }
}
