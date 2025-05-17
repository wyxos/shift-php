<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ShiftController extends Controller
{
    /**
     * Display the shift dashboard.
     *
     * @return \Illuminate\View\View
     */
    public function index()
    {
        return view('shift::dashboard');
    }
}
