# Child first-use return package contract

An authorized future first-use produces one fixed file:

```text
STEP-03_CHILD_FIRST_USE_OBSERVATION.json
```

It must validate against `03-FIRST-USE-OBSERVATION-SCHEMA.json`, bind to the exact review identity and run seed, and contain no name, school, age, birthday, IP address, device identifier, image, audio, video, transcript, or contact information.

Allowed package members:

- the observation JSON;
- the already-generated local playtest-event export for the same anonymous session, if the parent chooses to include it;
- a machine-generated validation summary with hashes.

The package must remain local until the parent explicitly returns it. It must not include browser storage wholesale, screenshots of the child, recordings, or unrelated files. A future analysis must keep technical behavior, parent interpretation, and child acceptance as separate decisions.
