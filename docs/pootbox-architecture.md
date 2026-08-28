# PootBox UI responsibility map

`PootBox.tsx` composes the Play surface. New behavior should live with the
owner below and enter the component through a focused interface; line-count
reduction alone is not a reason to move code.

| Concern | Owner | Boundary |
|---|---|---|
| Recording and upload reconciliation | `hooks/useRecording.ts`, `syncQueue.ts` | Microphone phases, local-first save, idempotent upload/delete operations, retry, status, and cancellation callbacks. IndexedDB owns queued work. |
| Controlled sharing | `shareOrchestration.ts`, `components/ShareSheet.tsx` | The service selects durable `/uploads/` audio, mints/looks up codes, distinguishes offline/server/network outcomes, propagates aborts, and creates imported pages. The sheet owns presentation state. |
| Page persistence | `hooks/usePagesState.ts`, `recordings.ts` | Page CRUD and IndexedDB persistence. Callers explicitly persist after adding or changing a page. |
| Audio/play state | `audioManager.ts`, `hooks/useSoundPlaying.ts` | Single-voice playback, stop, current-card identity, and subscription. PootBox adds visual ripple/combo feedback only. |
| Modal coordination | `hooks/useModalState.ts` | Open/close state for settings, library, sharing, recording, and first-run surfaces. Individual modal components own their internal form state. |
| Social actions | dormant feature components plus guarded PootBox adapters | Public profiles, follows, feed, comments, reactions, and public listing stay behind both v1 safety flags. They must not acquire production reachability incidentally. |

Effects that cross persistence or network boundaries require a visible status
or a typed result. Upload/delete retries are durable and idempotent; share mint
is a single explicit request that surfaces failure; lookup returns an explicit
offline signal; aborts are never converted into ordinary “not found” results.
Browser E2E tests protect recording, reload, sharing, offline behavior, and the
mobile sheet layout before these boundaries are changed.
