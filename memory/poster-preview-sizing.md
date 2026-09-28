---
name: Poster preview sizing
description: Readability checks for 4:5 posters shown in smaller canvas iframes.
---

**Rule:** Judge poster typography at both the 1080×1350 export scale and the reduced canvas-preview scale. Relative container units shrink with the iframe, so readable output typography can look too small in a 720px preview.

**Why:** The initial poster previews appeared unreadable at canvas scale even though the artwork retained its 4:5 dimensions.

**How to apply:** Keep previews at the export aspect ratio, capture them at their actual canvas size, and inspect both the scaled view and output-scale typography before deciding that font sizes are adequate.

**Multi-page rule:** Every independently shareable continuation image should identify the deceased and carry an unambiguous page marker.

**Why:** Exported pages may be forwarded separately from the first card.

**How to apply:** When changing pagination, keep identity and page numbering visible on continuation images without shrinking body text to force everything onto one page.