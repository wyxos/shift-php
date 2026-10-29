{!! $greeting ?: ($subject ?: __('SHIFT notification')) !!}

@foreach ($introLines as $line)
{!! $line !!}

@endforeach
@isset($actionText)
{!! $actionText !!}: {!! $actionUrl !!}

@endisset
@foreach ($outroLines as $line)
{!! $line !!}

@endforeach
@if (! empty($salutation))
{!! $salutation !!}

@endif
@lang('Sent by SHIFT')
© {{ date('Y') }} SHIFT. @lang('All rights reserved.')
