<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, Minus, Plus, RotateCcw, X } from 'lucide-vue-next'
import { Dialog, DialogContent } from '@shift/ui/dialog'

const props = defineProps<{
  open: boolean
  src: string
  alt?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0, ox: 0, oy: 0 })

const canZoomOut = computed(() => scale.value > 1)
const canZoomIn = computed(() => scale.value < 5)

function resetView() {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
  isPanning.value = false
}

function zoomBy(delta: number) {
  const next = Math.min(5, Math.max(1, scale.value + delta))
  scale.value = next
  if (next === 1) {
    offsetX.value = 0
    offsetY.value = 0
  }
}

function onWheel(e: WheelEvent) {
  if (!props.open) return
  e.preventDefault()
  zoomBy(e.deltaY < 0 ? 0.25 : -0.25)
}

function onPointerDown(e: PointerEvent) {
  if (scale.value <= 1) return
  isPanning.value = true
  panStart.value = { x: e.clientX, y: e.clientY, ox: offsetX.value, oy: offsetY.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return
  offsetX.value = panStart.value.ox + (e.clientX - panStart.value.x)
  offsetY.value = panStart.value.oy + (e.clientY - panStart.value.y)
}

function onPointerUp(e: PointerEvent) {
  if (!isPanning.value) return
  isPanning.value = false
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) resetView()
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-w-[min(96vw,1100px)] gap-0 p-0 sm:max-w-[min(96vw,1100px)] [&>button]:hidden"
      aria-label="Image preview"
    >
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-medium text-foreground">{{ alt || 'Image' }}</div>
          <div class="text-xs text-muted-foreground">Scroll to zoom. Drag to pan.</div>
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-muted disabled:opacity-50"
            :disabled="!canZoomOut"
            title="Zoom out"
            @click="zoomBy(-0.25)"
          >
            <Minus class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-muted disabled:opacity-50"
            :disabled="!canZoomIn"
            title="Zoom in"
            @click="zoomBy(0.25)"
          >
            <Plus class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-muted"
            title="Reset"
            @click="resetView"
          >
            <RotateCcw class="h-4 w-4" />
          </button>
          <a
            v-if="src"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-muted"
            :href="src"
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
          >
            <Download class="h-4 w-4" />
          </a>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground transition hover:bg-muted"
            title="Close"
            @click="emit('update:open', false)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        class="relative h-[min(76vh,760px)] w-full overflow-hidden bg-black/95"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <img
          v-if="src"
          :src="src"
          :alt="alt || ''"
          class="absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
          :class="scale > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'"
          :style="{
            transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`,
          }"
          draggable="false"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
