<?php

namespace Wyxos\Shift;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TasksAwaitingFeedback extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(public array $data)
    {
        // Expected data:
        // user_id, task_ids, task_count
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
        $taskCount = $this->data['task_count'] ?? count($this->data['task_ids'] ?? []);
        $url = route('shift.dashboard') . '/tasks?status=awaiting-feedback';

        $message = (new MailMessage)
            ->subject("Tasks Awaiting Your Feedback")
            ->line("You have {$taskCount} " . ($taskCount == 1 ? "task" : "tasks") . " awaiting your feedback.")
            ->action('View Tasks', $url)
            ->line('Please do not reply to this email directly.');

        return $message;
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
