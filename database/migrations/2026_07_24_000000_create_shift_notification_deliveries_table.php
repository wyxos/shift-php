<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_notification_deliveries', function (Blueprint $table) {
            $table->id();
            $table->uuid('delivery_id')->unique();
            $table->string('handler');
            $table->string('body_hash', 64);
            $table->boolean('production');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_notification_deliveries');
    }
};
