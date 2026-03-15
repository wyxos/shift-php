<?php

namespace Wyxos\Shift\Contracts;

interface ResolvesShiftCollaborators
{
    public function resolve(?string $search = null): iterable;
}
