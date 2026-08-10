# STEP 07 Adult-Tool Scroll Matrix

Policy: `SAME_ORIGIN_ALLOWED` / `EXTERNAL_NETWORK_FORBIDDEN`.

Touch rows use Chromium CDP `Input.dispatchTouchEvent`; no `scrollTo`, `scrollIntoView`, or `scrollTop = ...` is used as touch proof.

Result: 35/35 PASS

| Route | Project | Viewport | Inputs | Max scroll | Horizontal overflow | External | Status |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| STEP 02 review | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 11241 | 0 | 0 | PASS |
| STEP 03 review | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 4920 | 0 | 0 | PASS |
| STEP 04 observer fixture | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 3208 | 0 | 0 | PASS |
| STEP 05 review fixture | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 2127 | 0 | 0 | PASS |
| STEP 06 observer fixture | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 4476 | 0 | 0 | PASS |
| Machine review report | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 1989 | 0 | 0 | PASS |
| STEP 07 observer fixture | desktop-chromium | 320x568 | mouse-wheel, Home, PageDown, Home, End, Home | 2580 | 0 | 0 | PASS |
| STEP 02 review | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 11073 | 0 | 0 | PASS |
| STEP 03 review | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 4552 | 0 | 0 | PASS |
| STEP 04 observer fixture | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 2709 | 0 | 0 | PASS |
| STEP 05 review fixture | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 1718 | 0 | 0 | PASS |
| STEP 06 observer fixture | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 4120 | 0 | 0 | PASS |
| Machine review report | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 1453 | 0 | 0 | PASS |
| STEP 07 observer fixture | desktop-chromium | 390x844 | mouse-wheel, Home, PageDown, Home, End, Home | 2202 | 0 | 0 | PASS |
| STEP 02 review | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 5425 | 0 | 0 | PASS |
| STEP 03 review | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 1930 | 0 | 0 | PASS |
| STEP 04 observer fixture | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 1245 | 0 | 0 | PASS |
| STEP 05 review fixture | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 853 | 0 | 0 | PASS |
| STEP 06 observer fixture | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 3297 | 0 | 0 | PASS |
| Machine review report | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 758 | 0 | 0 | PASS |
| STEP 07 observer fixture | desktop-chromium | 768x1024 | mouse-wheel, Home, PageDown, Home, End, Home | 1485 | 0 | 0 | PASS |
| STEP 02 review | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 3580 | 0 | 0 | PASS |
| STEP 03 review | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 1362 | 0 | 0 | PASS |
| STEP 04 observer fixture | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 1193 | 0 | 0 | PASS |
| STEP 05 review fixture | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 776 | 0 | 0 | PASS |
| STEP 06 observer fixture | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 3361 | 0 | 0 | PASS |
| Machine review report | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 802 | 0 | 0 | PASS |
| STEP 07 observer fixture | desktop-chromium | 1440x900 | mouse-wheel, Home, PageDown, Home, End, Home | 1595 | 0 | 0 | PASS |
| STEP 02 review | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 11073 | 0 | 0 | PASS |
| STEP 03 review | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 4552 | 0 | 0 | PASS |
| STEP 04 observer fixture | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 2709 | 0 | 0 | PASS |
| STEP 05 review fixture | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 1718 | 0 | 0 | PASS |
| STEP 06 observer fixture | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 4120 | 0 | 0 | PASS |
| Machine review report | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 1453 | 0 | 0 | PASS |
| STEP 07 observer fixture | mobile-touch-chromium | 390x844-touch | touch-swipe, Home | 2202 | 0 | 0 | PASS |
