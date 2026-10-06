# Uneven word spacing in share images

- **Date**: 2026-10-05
- **Area**: share images (`src/components/share/`, `src/app/**/opengraph-image.tsx`)

## Symptom

Generated Open Graph images showed gaps between some words that were wider than others: "San Francisco  voter" on the site-wide image, "Corporation  and a Public Bank" on Prop B, and loose spacing in "Top 3 of 8 candidates" and "16 of 28 guides".

## Root cause

The image renderer (satori, via `next/og`) splits text at word boundaries (`Intl.Segmenter`) and lays out each word as its own box. A word's box comes out wider than the word as drawn: kerning is applied when the glyphs are drawn but missing from the width used for layout. The next word starts after the wider box, so every gap grows by the kerning inside the word before it. Words with more kerning pairs ("Francisco", "Every") open bigger gaps.

Measurements at 54px Geist SemiBold:

| | satori | Chrome |
|---|---|---|
| Width of "Every" | 150px (layout box) | 144.9px (`measureText`) |
| Width of "Every San" | 263px | 257.7px |
| Word gaps in "Every San Francisco voter guide in one" | 21 21 21 21 21 18 | 16 20 16 16 17 18 |

The ink of "Every" ends at the same x in both renders, so the glyphs match and only the layout width differs. The space glyph is the same width in both: Chrome measures it at 0.236em, and there is no kerning across spaces.

## Repro

Render the same string with `ImageResponse` twice: once with normal spaces and once with every space replaced by U+00A0. Then compare the gaps between ink runs (sharp, greyscale, scan a text band).

- **Normal spaces**: the gaps are uniform and about 5px wider than Chrome's.
- **NBSP**: the gaps match Chrome within 1-2px (17 21 16 16 19 18), because the line stays one segment and is measured and drawn as a single kerned run.

## Fix

Share-image text is drawn as one run per line.

- **`run(text)`** (`ShareFrame.tsx`) turns spaces into non-breaking spaces. It is used for every single-line string: wordmark, date line, lead, sub, legend, seat rows.
- **`Lines`** (`ShareFrame.tsx`) breaks multi-line text with `breakLines` (`src/lib/share.ts`, tested) and draws each line as one run. Line breaking is greedy by character count, never ends a line on "·", and cuts the last line with "…". It is used for titles, measure descriptions, and the site-wide tagline.

## Verification

- `vitest` (`tests/share.test.ts`, `breakLines` cases), tsc, and `next build`.
- Regenerated all images in `/private/tmp/bbshots/og/`.
- The tagline's word gaps now match Chrome rendering the same font and size within 1px: satori 15 19 13 14, Chrome 14 18 13 14.
- Zoomed crops of the wordmark, tagline, description, lead line, and seat rows are in `/private/tmp/bbshots/og/zoom/`.

## Guardrail

Any text in a share image goes through `run()` or `<Lines>`. Raw strings with spaces inside `ImageResponse` JSX reintroduce the gaps. The comment on `run()` names the cause.
