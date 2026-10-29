@php
    $portalUrl = rtrim((string) config('shift.url'), '/') ?: 'https://shift.wyxos.com';
    $dashboardUrl = \Illuminate\Support\Facades\Route::has('shift.dashboard') ? route('shift.dashboard') : config('app.url');
    $heading = $greeting ?: ($subject ?: __('SHIFT notification'));
@endphp
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{ $subject ?: 'SHIFT' }}</title>
<style>
@media only screen and (max-width: 600px) {
    .shift-wrapper { padding: 20px 12px 24px !important; }
    .shift-email { width: 100% !important; }
    .shift-header, .shift-content, .shift-subcopy { padding-left: 24px !important; padding-right: 24px !important; }
    .shift-heading { font-size: 24px !important; }
    .shift-button { display: block !important; text-align: center !important; }
}
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5fb; color: #0f172a; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; background-color: #f1f5fb; font-family: Arial, Helvetica, sans-serif;">
<tr>
<td class="shift-wrapper" align="center" style="padding: 48px 24px 32px;">
<!--[if mso]>
<table class="shift-outlook-container" align="center" width="600" cellpadding="0" cellspacing="0" role="presentation" style="width: 600px;">
<tr><td>
<![endif]-->
<table class="shift-email" width="600" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 600px; table-layout: fixed; background-color: #ffffff; border-radius: 12px;">
<tr>
<td class="shift-header" bgcolor="#0f172a" style="padding: 28px 36px; background-color: #0f172a; border-radius: 12px 12px 0 0;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tr>
<td>
<a href="{{ $dashboardUrl }}" style="display: inline-block; color: #ffffff; text-decoration: none;">
<img src="{{ $portalUrl }}/brand/shift-wordmark-email.png" width="124" height="31" alt="SHIFT" style="display: block; width: 124px; height: 31px; border: 0; color: #ffffff; font-size: 22px; font-weight: bold;">
</a>
</td>
<td align="right" style="color: #c4d4f0; font-size: 13px; line-height: 20px;">Notification</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="shift-content" style="padding: 32px 36px; overflow-wrap: anywhere; word-break: break-word;">
<h1 class="shift-heading" style="margin: 0 0 20px; color: #0f172a; font-size: 26px; line-height: 1.25; letter-spacing: -0.6px; font-weight: 700;">{{ $heading }}</h1>
@foreach ($introLines as $line)
<p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 24px;">{{ $line }}</p>
@endforeach
@isset($actionText)
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; margin: 26px 0 15px;">
<tr>
<td>
<a class="shift-button" href="{{ $actionUrl }}" target="_blank" rel="noopener" style="display: inline-block; border-style: solid; border-color: #2563eb; border-width: 14px 23px; border-radius: 6px; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; line-height: 18px; text-decoration: none;">{{ $actionText }}</a>
</td>
</tr>
</table>
@endisset
@foreach ($outroLines as $line)
<p style="margin: 15px 0 0; color: #64748b; font-size: 12px; line-height: 19px;">{{ $line }}</p>
@endforeach
@if (! empty($salutation))
<p style="margin: 20px 0 0; color: #475569; font-size: 15px; line-height: 24px;">{{ $salutation }}</p>
@endif
</td>
</tr>
@isset($actionText)
<tr>
<td class="shift-subcopy" style="padding: 21px 36px 25px; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
<p style="margin: 0 0 5px; color: #64748b; font-size: 12px; line-height: 19px;">@lang('Or open this link in your browser:')</p>
<a href="{{ $actionUrl }}" style="color: #2859b7; font-size: 12px; line-height: 19px; overflow-wrap: anywhere; word-break: break-all; text-decoration: underline;">{{ $displayableActionUrl }}</a>
</td>
</tr>
@endisset
</table>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 600px; margin: 22px auto 0;">
<tr>
<td align="center" style="color: #64748b; font-size: 11px; line-height: 18px;">
@lang('Sent by SHIFT')<br>
© {{ date('Y') }} SHIFT. @lang('All rights reserved.')
</td>
</tr>
</table>
<!--[if mso]>
</td></tr>
</table>
<![endif]-->
</td>
</tr>
</table>
</body>
</html>
