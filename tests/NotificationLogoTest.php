<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;
use Wyxos\Shift\TaskCreated;

class NotificationLogoTest extends TestCase
{
    public function test_notification_carries_its_current_logo_without_an_external_image_request(): void
    {
        config(['mail.default' => 'array', 'shift.url' => 'https://portal.example.test']);
        $notification = new TaskCreated(['task_id' => 42]);
        Notification::route('mail', '1@example.com')->notifyNow($notification);
        $message = Mail::mailer('array')->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
        $html = $message->getHtmlBody();
        $attachments = $message->getAttachments();

        $this->assertCount(1, $attachments);
        $logo = $attachments[0];
        $this->assertSame('shift-wordmark-email.png', $logo->getFilename());
        $this->assertSame('inline', $logo->getDisposition());
        $this->assertStringContainsString('cid:shift-wordmark-email.png', $html);
        $this->assertStringNotContainsString('https://portal.example.test/brand/', $html);
        $this->assertSame(file_get_contents(__DIR__.'/../resources/images/shift-wordmark-email.png'), $logo->getBody());
        $mime = $message->toString();
        $this->assertStringContainsString('Content-ID: <'.$logo->getContentId().'>', $mime);
        $this->assertStringContainsString('cid:'.$logo->getContentId(), quoted_printable_decode($mime));
        $this->assertStringContainsString('Content-Type: image/png', $mime);
        $this->assertStringNotContainsString('<img', $message->getTextBody());
    }
}
