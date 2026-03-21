<script lang="ts" setup>
import { Button } from '@shift/ui/button';
import { Dialog, DialogContent } from '@shift/ui/dialog';

interface Props {
    open: boolean;
    setOpen: (value: boolean) => void;
    discard: () => void;
}

defineProps<Props>();
</script>

<template>
    <Dialog :open="open" @update:open="setOpen">
        <DialogContent class="sm:max-w-md">
            <div class="space-y-2">
                <div class="text-base font-semibold">Discard changes?</div>
                <div class="text-muted-foreground text-sm">You have unsaved changes. If you close now, they will be lost.</div>
            </div>

            <div class="mt-6 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" @click="setOpen(false)">Cancel</Button>
                <Button type="button" variant="destructive" @click="discard">Discard</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>
