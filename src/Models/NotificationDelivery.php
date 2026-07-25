<?php

namespace Wyxos\Shift\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationDelivery extends Model
{
    protected $table = 'shift_notification_deliveries';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'production' => 'boolean',
            'processed_at' => 'datetime',
        ];
    }
}
