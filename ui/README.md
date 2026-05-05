# SHIFT Dashboard UI

This is the embedded dashboard UI shipped by the `wyxos/shift-php` package.

Build it from `packages/shift-php/ui` with:

```sh
npm run build
```

Then publish the generated package assets from the harness root:

```sh
php artisan shift:publish --group=public
```

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
