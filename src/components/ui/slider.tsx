"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onPointerDown,
  onKeyDown,
  onBlur,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const [pointer, setPointer] = React.useState(false)
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      data-pointer={pointer || undefined}
      onPointerDown={e => {
        setPointer(true)
        onPointerDown?.(e)
      }}
      onKeyDown={e => {
        setPointer(false)
        onKeyDown?.(e)
      }}
      onBlur={e => {
        setPointer(false)
        onBlur?.(e)
      }}
      className={cn(
        "group/slider relative flex w-full cursor-pointer touch-none items-center select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-4 data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full bg-foreground/15 transition-[height,width] duration-150 motion-reduce:transition-none data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1 group-hover/slider:data-[orientation=horizontal]:h-1.5 group-hover/slider:data-[orientation=vertical]:w-1.5 group-active/slider:data-[orientation=horizontal]:h-1.5 group-active/slider:data-[orientation=vertical]:w-1.5"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-3.5 shrink-0 rounded-full border border-foreground/20 bg-foreground/85 ring-ring/50 backdrop-blur-sm transition-[scale,box-shadow] duration-150 outline-none group-hover/slider:scale-110 group-active/slider:scale-125 focus-visible:ring-[3px] group-data-[pointer]/slider:ring-0 motion-reduce:transition-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
