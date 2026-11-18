---
name: framer-motion
description: "Framer Motion animation expert for React. Triggers on: animate, motion, transition, spring, variants, gesture, drag, scroll animation, page transition, AnimatePresence, useAnimation, useScroll, useTransform, useSpring, whileHover, whileTap, layout animation, shared element transition, orchestration, stagger, keyframes. Projects: React, Next.js, Remix. Tasks: add animation, create transition, implement gesture, build scroll effect, animate component, fade in, slide, scale, rotate, drag and drop."
---
# Framer Motion - Animation Expert

Expert guide for implementing production-grade animations with Framer Motion in React/Next.js projects.

## Core Principles

- Always use `motion.*` components instead of HTML elements when animation is needed
- Prefer `variants` for reusable animation states across components
- Use `AnimatePresence` for mount/unmount animations
- Combine `useScroll` + `useTransform` for scroll-driven effects
- Use `layout` prop for automatic layout animations (no manual calculation)
- Prefer spring physics (`type: "spring"`) over easing for natural feel

## Animation Patterns

### Basic Fade + Slide In
```tsx
import { motion } from "framer-motion"

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>
```

### Variants (Stagger Children)
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => <motion.li key={i} variants={item} />)}
</motion.ul>
```

### Page Transitions (Next.js App Router)
```tsx
// layout.tsx wrapper
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

### Scroll-Driven Parallax
```tsx
const { scrollYProgress } = useScroll()
const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])

<motion.div style={{ y }} />
```

### Gesture Interactions
```tsx
<motion.button
  whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
/>
```

### Shared Element Transition (layoutId)
```tsx
// List item → Detail card transition
{selected ? (
  <motion.div layoutId={`card-${id}`} className="detail-card" />
) : (
  <motion.div layoutId={`card-${id}`} className="list-item" />
)}
```

### Drag with Constraints
```tsx
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
  dragElastic={0.2}
  dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
/>
```

## Performance Rules

1. Use `will-change: transform` on frequently animated elements
2. Animate `transform` and `opacity` only — never `width`/`height`/`top`/`left`
3. Use `useMotionValue` + `useTransform` for imperative scroll effects (avoids re-renders)
4. Add `layout="position"` instead of `layout` when only position changes
5. Use `LazyMotion` + `domAnimation` to reduce bundle size:
```tsx
import { LazyMotion, domAnimation, m } from "framer-motion"
// Use <m.div> instead of <motion.div>
```

## Spring Presets

| Feel | stiffness | damping | mass |
|------|-----------|---------|------|
| Snappy | 400 | 17 | 1 |
| Bouncy | 300 | 10 | 1 |
| Smooth | 100 | 20 | 1 |
| Slow/Heavy | 50 | 15 | 2 |

## Common Mistakes to Avoid

- Don't use `animate` without `initial` — causes flash of unanimated state
- Don't animate layout-triggering properties (width, height, padding) — use `layout` prop
- Don't forget `AnimatePresence` wrapper for exit animations
- Don't use string values for transform — use numbers: `rotate: 180` not `rotate: "180deg"`
- Don't mix `variants` and direct `animate` object on the same component

## Installation

```bash
npm install framer-motion
# or
pnpm add framer-motion
```

For Next.js App Router, mark animated components with `"use client"`.
