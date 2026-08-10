<?php

namespace Wyxos\Shift\Exceptions;

use RuntimeException;

class CollaboratorResolverNotConfigured extends RuntimeException
{
    public static function forCurrentEnvironment(): self
    {
        $environment = trim((string) config('app.env', '')) ?: 'current';

        return new self(
            "SHIFT collaborator resolver is not configured for the {$environment} environment. "
            .'Set shift.collaborators.resolver to an application resolver.'
        );
    }
}
