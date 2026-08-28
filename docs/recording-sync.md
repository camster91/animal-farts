# Durable recording synchronization

PootBox treats local capture as the immediate user success path and server synchronization as a durable background operation.

## Client state

IndexedDB database `pootbox` version 3 contains `pages`, `blobs`, and `sync-operations`. Upgrading from version 2 creates the queue without replacing existing pages or audio blobs.

Each upload or deletion has a stable operation UUID, bubble ID, creation time, attempt count, next-attempt time, status, and last error. Upload operations also retain the audio Blob and metadata. Delete operations are tombstones and may wait for a pending upload to return its server recording ID.

The queue runs at startup, on the browser `online` event, every 30 seconds while Play is mounted, and after a new operation. Retryable network/HTTP failures use bounded exponential backoff from 2 seconds to 5 minutes. Validation, authorization, and other terminal 4xx failures remain visible as `failed` until the user selects Retry. A compact in-app banner distinguishes waiting/syncing work from failures.

Removing a card first commits its deletion tombstone. The card and local Blob are removed only after that durable write succeeds. An upload already in flight observes the tombstone, records its returned server ID on the delete operation, and suppresses the normal uploaded-card callback.

## Server idempotency

Queued mutations send `x-operation-id` alongside `x-device-id`.

- Uploads store `client_operation_id` and enforce uniqueness per device. Repeating an upload operation returns the original recording and audio path and removes the redundant temporary file.
- Successful deletes store a 90-day `(device, operation)` tombstone. Repeating the same delete returns success even though the recording and audio are already gone.
- A delete transaction removes votes, comments, reactions, share codes, recording metadata, and the audio file. A retry that receives 404 is considered reconciled by the client; 403 is terminal and shown for manual retry/review.

The operation ID is an idempotency key, not authentication. Ownership continues to be enforced with the device identifier.

## Verification

- `tests/unit-sync-queue.test.mjs` uses a real IndexedDB implementation to cover v2 migration, persisted upload intent, offline retry, stable idempotency keys, upload/delete races, 404 reconciliation, 403 terminal failure, and bounded backoff.
- `tests/server-integration.test.mjs` exercises duplicate multipart upload and repeated delete operations against the real Express/SQLite server.
