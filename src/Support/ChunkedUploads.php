<?php

namespace Wyxos\Shift\Support;

use RuntimeException;

final class ChunkedUploads
{
    private const CORE_CLASS = 'Shift\\Core\\ChunkedUploadConfig';

    public static function maxUploadBytes(): int
    {
        return self::coreConstant('MAX_UPLOAD_BYTES');
    }

    public static function maxUploadKb(): int
    {
        return self::coreConstant('MAX_UPLOAD_KB');
    }

    public static function chunkSizeBytes(): int
    {
        return self::coreConstant('CHUNK_SIZE_BYTES');
    }

    public static function chunkSizeKb(): int
    {
        return self::coreConstant('CHUNK_SIZE_KB');
    }

    private static function coreConstant(string $name): int
    {
        if (! class_exists(self::CORE_CLASS)) {
            throw new RuntimeException(
                'Missing dependency wyxos/shift-core. Run `composer update wyxos/shift-php` in the consuming app and commit composer.lock.'
            );
        }

        $value = constant(self::CORE_CLASS.'::'.$name);

        if (! is_int($value)) {
            throw new RuntimeException('Unexpected '.self::CORE_CLASS.'::'.$name.' type.');
        }

        return $value;
    }
}
