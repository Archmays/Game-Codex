# English interactive pilot: built-in ChatGPT image prompts

## Final fresh pose sheet candidate

```text
【ChatGPT image】
Create a game-ready TRANSPARENT character sprite sheet, transparent background PNG. One consistent fictional storybook child repeated in six movement poses, arranged in exactly 3 columns and 2 rows. 1536x1024 canvas, each cell 512x512, consistent full-body scale and center, clear space between figures. Warm brown skin, short curly brown hair, orange T-shirt, teal shorts, teal sneakers with white socks and cream soles, watercolor cutout illustration. Every pose faces right, identical hair, face, outfit, proportions and light from upper-left.
Pose order: standing at rest; running first step with near leg forward and near arm back; running opposite step with near leg extended back and near arm forward; two-foot crouched jump takeoff; airborne bent-knee jump with arms lifted; two-foot bent-knee soft landing. Running poses must be distinct alternating phases. Grounded feet line up at y=460 within each cell; figures never exceed their cell. Clean cutout silhouettes, opaque rich character colors, transparent negative space. No backgrounds, no ground plane, no cast shadows, no haze, no glow. Only the six isolated figures and transparent space. No text, no labels, no UI, no extra characters, no duplicate run pose.
```

## Transparent extraction candidate

```text
【ChatGPT image】
Background extraction only. Convert the attached six-pose character sprite sheet to a TRUE TRANSPARENT PNG with an RGBA alpha channel. Remove the existing light gray/white checkerboard pixels from around all six figures. The checkerboard is unwanted baked content, NOT transparency. All area outside the six precise character silhouettes must have alpha=0. Do not draw another checkerboard or substitute white, black, colored or gradient backgrounds. No shadows, haze, glow or background pixels. Keep the six child figures exactly as shown: same poses, same face and clothing, same positions and scale in their current 3x2 grid. Preserve opaque white shoe soles and socks as parts of the figures, preserve fine curly hair edges. No other edits. Output a clean game-ready cutout sheet, transparent PNG, 1536x1024.
```

## Character repair: opposite running phase and edge transparency

```text
【ChatGPT image】
Edit target: attached six-pose sprite sheet. Production repair, preserve exact SAME fictional child identity, outfit, watercolor treatment, six-cell 3x2 layout, 1536 x 1024 dimensions, view direction, complete hands/hair/shoes, and all poses except upper-right running phase.
Mandatory fix 1: Remove ALL background and colored haze/halos surrounding each character. The only opaque or partially opaque pixels must be the actual character silhouette plus a tiny antialiased edge. Everything outside each body/hair/clothing/shoe contour must be truly zero alpha. No diffuse shadow, no glow, no brown haze, no green haze, no fog, no vignette, no checkerboard pixels. A real transparent PNG suitable to overlay on bright grass with NO rectangular or cloudy backdrop. Keep internal character shading intact.
Mandatory fix 2: Change only the UPPER-RIGHT cell to the opposite running phase, visibly distinct from UPPER-MIDDLE. In the upper-middle the near leg has its knee forward and forward shoe extended in front; in upper-right the NEAR leg now extends straight backward in push-off, heel lifted behind, while FAR leg passes underneath the hip with bent knee advancing forward; near arm reaches forward and far arm goes back. Body leans forward, both arms bent, same head and body size, normal anatomy. These two frames must visibly alternate limbs, not repeat a static running pose. Keep all other cells: idle upper-left; two-foot bent-knee takeoff lower-left; compact airborne jump lower-middle; safe two-foot bent-knee landing lower-right.
Grid cells remain exactly 512px square, each pose centered within its own cell, all grounded soles at local y=465, no element crossing cells. No added text/labels, numbers, ground line, background, props, paths, motion trails, bonus frames, or extra limbs. Deliver polished transparent six-pose sprite PNG.
```

## Character pose sheet candidate

```text
【ChatGPT image】
Use case: illustration-story / production character sprite sheet. Create ONE transparent PNG 1536 x 1024 arranged as an exact grid of 3 columns x 2 rows, six equally sized 512 x 512 cells, with NO visible dividing lines. Each cell contains one full-body pose of the SAME fictional child, always facing right in a readable three-quarter side view. Identity: cheerful cartoon child, warm medium-brown skin, short curly dark-brown hair, coral-orange plain short-sleeve T-shirt, deep teal knee-length shorts, white socks, teal sneakers with cream soles. No logos or accessories, no real-person reference. Soft storybook watercolor/gouache, clean alpha edges, restrained shading with upper-left sunlight, accurate consistent anatomy and clothing proportions across all six poses.
Grid reading order: upper left = relaxed standing idle, both feet grounded; upper middle = running stride A, right knee forward, left leg extended behind, elbows actively bent in opposite directions, clearly a run; upper right = running stride B, alternate support/flight phase, left knee forward and right leg behind, opposite arm swing, clearly different from stride A; lower left = jump takeoff, knees bent preparing to push upward with both feet together, arms beginning forward/upward; lower middle = airborne jump, both knees bent, both feet off the ground, arms lifted, body centered and upright without changing outfit or identity; lower right = safe jump landing, both sneakers nearly side by side, knees bent to absorb landing, arms spread for balance, feet at the common baseline. Each pose must be centered horizontally inside its own cell, entire hands/hair/shoes visible with at least 35 px clear padding, no overlaps between cells. Preserve consistent head size, body scale and lighting; common reference ground baseline near y=455 of each 512px cell; idle figure about 380px tall. Airborne pose is rendered in its own cell, do not add jump trails; the game moves the whole sprite along a path. Actual transparent alpha surrounding figures, no background, no ground line, no drop shadow, no checkerboard texture, no text or pose labels, no numbers, no baked UI. Avoid standing translated as a run, feet cropped, giant heads differing between poses, extra fingers/limbs, different children, motion blur, duplicates of the same running phase.
```

## Color & Number Pier environment

```text
【ChatGPT image】
Use case: illustration-story.
Asset type: production environment plate, Color & Number Pier children's English game, 1536 x 1024 landscape. Warm refined storybook gouache and watercolor, softly textured paper, sunlight from upper left; match the gentle sage, cream and turquoise palette of a sunny island park. Camera elevated side-on, almost orthographic, clear view of a quiet waterfront. Composition: upper quarter distant pale sky and very faint uninhabited coastline, middle half open calm pale turquoise water with subtle horizontal ripples, lower quarter a broad uninterrupted warm sandy-tan wooden pier board surface seen from above at a gentle angle. Keep the central field, the pier surface, and the entire middle open for programmable countable objects. A few rope posts confined to extreme left/right lower edges; no posts in the central playable field. No painted boats or boat-like silhouettes, no shells, animals, people, buoys, stars, reflections resembling extra objects, docks projecting into central water, treasure, gates, rewards. Boat bodies and shells will be separate SVG layers; do not bake any into this background. No typography, signs, letters, numbers, UI, borders, watermark, collage. Opaque full-bleed art, no transparency checkerboard; quiet low contrast water allows red/blue individual boat bodies to remain legible. Not a map or a dashboard.
```

## Action Park environment

```text
【ChatGPT image】
Use case: illustration-story.
Asset type: production background for a small children's English game, Action Park, 1536 x 1024 landscape. Create a refined warm storybook gouache illustration consistent with soft watercolor children's vocabulary cutouts, natural paper texture and clean readable silhouettes. Camera: elevated side-on orthographic-like view, a low distant horizon at the upper quarter, no perspective vanishing path. Scene: a quiet sunny island park, rounded trees and soft shrubs confined to the far left/right margins and top quarter, faint distant hills, warm cream sunlight from upper left. The lower three quarters is a broad, nearly level pale sage-green open grass play field with very subtle texture, deliberately empty so programmable paths, landing pads, and one moving child can be placed above it. Keep the entire central 85 percent uncluttered, no baked route or platform whose position could conflict with the game rules. This is an environment plate only. Composition: no characters, no animals, no boats, no shells, no gates, no milestones or rewards; no words, letters, numbers, signage, UI, borders, watermark, collage panels or dramatic hazards. Opaque full-bleed background, not transparent; soften contrast in playable middle/lower field while retaining crafted scenic edges. No fake transparent checkerboard. This art is a gentle setting for directly operated run/jump routes, not a world map.
```
