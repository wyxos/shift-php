<?php

namespace Wyxos\Shift\Support;

use RuntimeException;

class InstallSessionRealtimeWaiter
{
    public function listen(array $session, ?int $deadline = null): InstallSessionApprovalListener
    {
        $metadata = $session['realtime'] ?? null;

        if (! is_array($metadata)) {
            throw new RuntimeException('SHIFT install session response did not include Reverb metadata.');
        }

        if (($metadata['broadcaster'] ?? null) !== 'reverb') {
            throw new RuntimeException('SHIFT install session response did not include supported Reverb metadata.');
        }

        return ReverbInstallSessionApprovalListener::connect($metadata, $deadline);
    }
}
