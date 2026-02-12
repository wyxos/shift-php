<?php

namespace Wyxos\Shift;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskCreated extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(public array $data)
    {
        // Expected data:
        // type, user_id, task_id, task_title, task_description, task_status, task_priority
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $taskTitle = $this->data['task_title'] ?? 'Task #'.$this->data['task_id'];
        $taskStatus = ucfirst($this->data['task_status'] ?? 'pending');
        $taskPriority = ucfirst($this->data['task_priority'] ?? 'medium');
        $url = route('shift.dashboard').'/tasks/'.$this->data['task_id'].'/edit';

        return (new MailMessage)
            ->subject("New Task Created: {$taskTitle}")
            ->line('A new task has been created and you have been granted access.')
            ->line("Task Title: {$taskTitle}")
            ->line("Priority: {$taskPriority}")
            ->line("Status: {$taskStatus}")
            ->when(! empty($this->data['task_description']), function ($message) {
                return $message->line('Description: '.$this->data['task_description']);
            })
            ->action('View Task', $url)
            ->line('Please do not reply to this email directly.');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
