# Parent observer guide

## Before the child arrives

1. Run `tools/hanzi-v2-step04/START_STEP_04_CHILD_FIRST_USE.cmd` and wait for the guarded parent preflight.
2. Confirm the exact accepted build identity. Choose a familiar device, comfortable brightness, and turn off notifications.
3. Confirm there will be no audio/video/screen recording, photograph, upload, account, name, age, school, birth date, contact detail, or exact device identifier.
4. Listen to the four phrases. Choose `SOUND_OK`, `START_MUTED`, or `CANCEL`.
5. Choose `LIVE_DASHBOARD` or `COMPACT_AFTER_SESSION`. Check READY only when prepared.
6. Say: `这里有一段小冒险，你可以自己看看。想停随时可以停。`

The preflight opens the child route only after exact authorization, READY, and an audio decision. A missing or expired session token is refused.

## During the session

Sit to the side. Do not require continuous Think Aloud or ask repeated why-questions. Let built-in hints appear first. Do not point to a card or slot and do not say the answer.

Intervention order:

1. `NONE`
2. `REPEAT_VISIBLE_COPY`: repeat only text already visible.
3. `POINT_TO_REGION_ONLY`: indicate only the world, board, or hand region.
4. `TECHNICAL_ASSIST`: fix device/input behavior without making a game choice.
5. `ADULT_ANSWER_REQUIRED`: record a core usability risk and stop the formal observation.
6. `STOPPED`: end immediately under a stop condition.

Use the eight checkpoint buttons: 首屏、首次施法、第二结构、能力选择、Boss intent、安全失败、营地修复、魔法书. Choose the visible Chinese observation value. Do not count invalid placements as a score or describe the child as wrong.

Keep the observer free of correct cards, slots, solver state, next answers, scores, or evaluative copy. If the live observer is unavailable, use the compact sheet after the session; the child game must remain playable.

## Stop

Keep `立即停止` visible. Stop on the child's request, distress, sensory discomfort, technical/privacy/identity problem, or need for an adult answer. Do not ask for completion. Use:

```text
先回营地休息，找到的汉字都还在。
```

Record only the stop code and already-collected minimum evidence.

## After completion or stopping

The two optional questions are:

```text
你最想再看哪一段？
有没有哪一处让你不知道发生了什么或不舒服？
```

The child may decline. Only now may the parent optionally show the accepted-scene favorite cards or Again-Again choices. Do not interpret `AGAIN_NOW` as learning or `STOP` as failure. A spontaneous replay and a parent-prompted replay are different; at most one extra run belongs to the formal package.

Export `STEP-04_CHILD_FIRST_USE_OBSERVATION.json`, inspect notes for privacy, then run FINISH. Do not commit or upload the observation JSON outside the explicit return package.
