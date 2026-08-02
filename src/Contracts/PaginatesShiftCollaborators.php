<?php

namespace Wyxos\Shift\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface PaginatesShiftCollaborators extends ResolvesShiftCollaborators
{
    public function paginate(?string $search = null, int $page = 1, int $perPage = 15): LengthAwarePaginator;
}
