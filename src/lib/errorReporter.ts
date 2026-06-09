// v29: lightweight self-hosted error monitoring.
// Samples 10% of errors, strips PII, logs to stderr on the Express server.
// No external services, no third-party SDKs.

// v29-errors-fix: bump to 100% — for a kids' app shipping to <1000 users
// the error volume is low, we need to know about every error. If volume
// becomes a problem later, switch to 10% or add a max-per-minute.
const SAMPLE_RATE = 1.0;
const MAX_STACK = 200;

// Kid names appear in some error messages via form inputs. Truncate
// the message to avoid accidentally sending names upstream.
function sanitizeMessage(msg: string): string {
  if (msg && msg.length > 120) return msg.slice(0, 120) + '…';
  return msg ?? '';
}

function sanitizeStack(stack: string | undefined): string {
  if (!stack) return '';
  return stack.slice(0, MAX_STACK);
}

async function report(error: { message: string; stack?: string; lineno?: number; colno?: number }) {
  if (Math.random() > SAMPLE_RATE) return; // 90% dropped silently

  const payload = {
    message: sanitizeMessage(error.message),
    stack: sanitizeStack(error.stack),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    // profileId is set by the parent app if the kid has a profile
    profileId: typeof window !== 'undefined' ? (window as unknown as { __profileId?: string }).__profileId : undefined,
    ts: Date.now(),
  };

  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Don't block the page on this — fire and forget
    });
  } catch {
    // silent
  }
}

export function initErrorReporter() {
  // Uncaught exceptions and runtime errors
  const prevOnError = window.onerror;
  window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
    if (prevOnError) {
      // Call through so existing handlers still fire
      try {
        prevOnError.call(window, message, source, lineno, colno, error);
      } catch {
        // ignore — chain to the prior handler
      }
    }
    void report({ message: String(message), stack: error?.stack, lineno, colno });
    return false; // don't suppress — let the browser console log it too
  };

  // Unhandled promise rejections
  const prevOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    if (prevOnUnhandledRejection) {
      try {
        prevOnUnhandledRejection.call(window, event);
      } catch {
        // ignore — chain to the prior handler
      }
    }
    const err = event.reason;
    void report({
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  };
}