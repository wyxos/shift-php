<?php

namespace Wyxos\Shift;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
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
            return route('shift.dashboard').'/tasks?task='.$this->data['task_id'];
        }

        return null;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $taskTitle = $this->data['task_title'] ?? 'Task #'.$this->data['task_id'];
        $threadType = ucfirst($this->data['type']).' thread';
        $snippet = Str::limit($this->previewContent(), 120);
        $url = $this->resolveUrl();

        $message = (new MailMessage)
            ->subject("New reply in {$threadType} for {$taskTitle}")
            ->line('A new message was posted.')
            ->line("Preview: \"{$snippet}\"")
            ->markdown('shift::notifications.email');

        if (! empty($url)) {
            $message->action('View Thread', $url);
        }

        return $message->line('Please do not reply to this email directly.');
    }

    private function previewContent(): string
    {
        $content = (string) ($this->data['content'] ?? '');
        $content = preg_replace('/<\s*\/?(?:p|div|br|li|ul|ol|blockquote|h[1-6]|tr|td|th)\b[^>]*>/i', ' ', $content) ?? $content;
        $text = html_entity_decode(strip_tags($content), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim((string) preg_replace('/\s+/', ' ', $text));
    }
}
