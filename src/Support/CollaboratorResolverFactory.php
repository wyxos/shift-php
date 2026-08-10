<?php

namespace Wyxos\Shift\Support;

use RuntimeException;
use Wyxos\Shift\Collaborators\DefaultCollaboratorResolver;
use Wyxos\Shift\Contracts\ResolvesShiftCollaborators;
use Wyxos\Shift\Exceptions\CollaboratorResolverNotConfigured;

class CollaboratorResolverFactory
{
    private const LEGACY_APPLICATION_RESOLVER = 'App\\Services\\ShiftCollaboratorResolver';

    public function make(): ResolvesShiftCollaborators
    {
        $resolver = config('shift.collaborators.resolver', DefaultCollaboratorResolver::class);

        if ($resolver === self::LEGACY_APPLICATION_RESOLVER && ! class_exists($resolver)) {
            $resolver = DefaultCollaboratorResolver::class;
        }

        if (! is_string($resolver) || trim($resolver) === '' || ! class_exists($resolver)) {
            throw CollaboratorResolverNotConfigured::forCurrentEnvironment();
        }

        $instance = app($resolver);

        if (! $instance instanceof ResolvesShiftCollaborators) {
            throw new RuntimeException(
                'SHIFT collaborator resolver must implement '.ResolvesShiftCollaborators::class.'.'
            );
        }

        return $instance;
    }
}
