<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ShiftController extends Controller
{
    /**
     * Display the shift dashboard.
     *
     * @return string
     */
    public function index()
    {
        return file_get_contents(public_path('/shift/index.html'));
    }
}
