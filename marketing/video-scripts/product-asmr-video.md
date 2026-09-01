# Product ASMR Video — Portable LED Sanitizer Case

No footage has been rendered. Artlist currently reports **0 free
generations remaining and no active credit plan**, so this is a
ready-to-use script + prompt package: generate the assets once credits
are available (see "Generation notes" below).

## Product reference (recreated from description)

The source photo could not be uploaded (pasted inline, no accessible
file/URL), so the product is described here for prompting an image
generator to recreate a close reference frame:

- Compact clamshell-style case, roughly palm-sized, rounded rectangular
  footprint with softly rounded corners.
- **Lid (top half):** glossy deep navy-blue, high-gloss reflective
  finish. Set into the lid near the hinge is a small rectangular window
  housing a digital LED display (segmented/clock-style digits, currently
  reading "00") next to a small four-point sparkle/diamond icon.
- **Base (bottom half):** matte black, slightly larger footprint than the
  lid, soft-touch finish, contrasts with the glossy top.
- **Front edge of the base:** one recessed circular power/function
  button, and a USB-C charging port immediately to its right.
- Overall aesthetic: minimalist two-tone tech gadget, premium/quiet-luxury
  feel, sits on a plain light-grey seamless background in the reference
  photo.

### Reference image prompt (text-to-image)

```
Studio product photo of a compact two-tone clamshell case, palm-sized,
rounded rectangular body. Top lid glossy deep navy-blue with a small
rectangular cutout showing a digital LED display reading "00" next to a
tiny sparkle icon. Bottom half matte black, slightly wider than the lid,
soft-touch finish. Front edge has one recessed circular button and a
USB-C port beside it. Shot on seamless light-grey background, soft
diffused studio lighting, 45-degree hero angle, sharp macro detail on
seams and finish contrast, no text or logo, no hands, ultra-realistic
product photography, 4k.
```

## Concept

Pure ASMR, no dialogue, no voiceover, no music track — only the
product's own tactile sounds (clicks, taps, glass-smooth surface
contact, soft mechanical hum) recorded/generated close-mic'd and in
slow motion. Total runtime target: **18–24 seconds**, edited as a loop
for Reels/TikTok/Shopify product page autoplay.

## Shot list

| # | Shot | Camera | Action | Sound cue |
|---|------|--------|--------|-----------|
| 1 | Extreme close-up, top-down | Static, slow push-in | Fingertip taps twice on the glossy navy lid | Two crisp, resonant taps |
| 2 | Macro, 3/4 angle | Slow orbit left-to-right | Lid opens on hinge, brief resistance then a soft click at full open | Mechanical click + faint spring release |
| 3 | Close-up on display window | Static, rack focus in | LED digits flicker on, "00" glows, sparkle icon blinks once | Soft electronic chime, subtle hum |
| 4 | Macro on front edge | Static | Fingertip presses the recessed button; a satisfying tactile click | Deep, muted click |
| 5 | Extreme close-up on seam | Slow horizontal pan | Fingernail glides along the glossy-to-matte seam line | Faint glassy drag / soft friction |
| 6 | Side profile, low angle | Slow pull-back | Case rotates slightly in-hand, light rakes across gloss vs. matte | Ambient room-tone only (near silence) |
| 7 | Top-down | Static, slow push-in | Lid closes, soft thud + magnetic-style snap | Muted thud + snap |
| 8 | Full product hero | Static hold, 2s | Case rests closed, display fades out | Silence / room tone, hold for loop point |

## Single continuous generation prompt (image-to-video)

Use this once a reference frame (from the prompt above, or the real
product photo) is available as the input image:

```
Extreme macro ASMR product video of a two-tone navy-and-black clamshell
gadget case. Slow, deliberate camera moves: push-in, then slow orbit.
A single fingertip taps the glossy lid twice, then opens it with a soft
mechanical click; the LED display glows on inside the lid window. A
fingertip presses the recessed front button with a satisfying click.
Shallow depth of field, soft studio key light with subtle rim light
catching the glossy-to-matte transition. No hands beyond fingertips, no
face, no text overlays, no music — only close-mic'd tactile sounds:
taps, a mechanical click, a soft electronic chime, a muted closing
thud. Calm, slow pacing, satisfying ASMR tone, 4k, shallow depth of
field, seamless light-grey background.
```

If the chosen model caps clip length below the full 18–24s target,
split the shot list into 2–3 generations (e.g. shots 1–3, 4–6, 7–8) and
stitch them, since each row above is already a self-contained beat.

## Generation notes (for when credits are available)

- **Reference frame:** `generate_image` (text-to-image) with the prompt
  above, or upload the real product photo via a public URL once one
  exists.
- **Video:** `generate_video` with `input: { assetId }` pointing at the
  reference frame, on an image-to-video model with native audio if the
  tactile sound effects should be baked in (e.g. a Veo 3.1 "with audio"
  or Kling "audio on" variant); otherwise generate silent and add SFX
  in post.
- **Duration:** request the closest supported length to 18–24s, or
  generate the 2–3 shorter segments described above and stitch.
- Check `get_generation_cost` before running, and re-check
  `get_balance` first — this account currently shows 0 free
  generations and no credit plan.

## Suggested caption / copy

> The click you didn't know you needed. 🖤

Short, no-hashtag-stuffing caption; let the ASMR sound carry the post.
