<?php

namespace Wyxos\Shift;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Shift\Core\Notifications\TaskThreadUpdated as CoreTaskThreadUpdated;

class TaskThreadUpdated extends CoreTaskThreadUpdated
{
    public function __construct(public array $data) {}

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
        $comments = $this->data['messages'] ?? [];
        if ($comments === []) {
            $comments = [$this->data];
        }
        $count = count($comments);
        $url = $this->resolveUrl();

        $message = (new MailMessage)
            ->subject($count === 1 ? "SHIFT: New reply on {$taskTitle}" : "SHIFT: {$count} new replies on {$taskTitle}")
            ->line($count === 1 ? 'A new message was posted.' : "{$count} new messages were posted.")
            ->view(['html' => 'shift::notifications.email', 'text' => 'shift::notifications.email-text']);

        foreach ($comments as $comment) {
            $snippet = Str::limit($this->previewContent((string) ($comment['content'] ?? '')), 120);
            $message->line("Preview: \"{$snippet}\"");
        }

        if (! empty($url)) {
            $message->action('View Thread', $url);
        }

        return $message->line('Please do not reply to this email directly.');
    }

    private function previewContent(string $content): string
    {
        $content = preg_replace('/<\s*\/?(?:p|div|br|li|ul|ol|blockquote|h[1-6]|tr|td|th)\b[^>]*>/i', ' ', $content) ?? $content;
        $text = html_entity_decode(strip_tags($content), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim((string) preg_replace('/\s+/', ' ', $text));
    }
}
