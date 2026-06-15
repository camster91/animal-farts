#!/usr/bin/env python3
"""v68: rewrite /opt/caddy/Caddyfile from a known-good curated
template. v66's insert-into-global-blocks logic was wrong
(it inserted the animals block inside the global options
block, where Caddy tried to parse it as a global option).
v66's accumulate-stray-`}` logic truncated the file when
repeated.

This v68: every run REWRITES the file from scratch, then
validates with `caddy validate` before restarting. Idempotent.
Brace-balanced. Robust to repeated runs.

The curated template is hand-built from the live container
state (animals on :3015, lull/lull-relay on Traefik :8443,
splash direct, hub/markup/contractions direct, etc.).
The alinenasseh.com + artisan.ashbi.ca blocks from the
prior Caddyfile state were removed in v73: the public
A-records for those hostnames point to WP Engine, not
this VPS, so any cert renewal via LE http-01 (the only
challenge Caddy has configured) always fails. After 5
failures, LE HTTP 429 rate-limits the cert acquisition
and Caddy spends ~1 min/hour wasted on hopeless renewals.
The alinenasseh / artisan PHP app on :8081 was never
reachable from the public internet anyway — its block
existed in the Caddyfile but no real traffic ever hit it.
"""
import re, sys, pathlib, subprocess

PATH = pathlib.Path("/opt/caddy/Caddyfile")

canonical = """\
animals.ashbi.ca {
  reverse_proxy 127.0.0.1:3015
}

photogen.ashbi.ca, status.photogen.ashbi.ca {
  reverse_proxy 127.0.0.1:32778
}

arcan-painting.ashbi.ca {
  reverse_proxy 127.0.0.1:3000
}

lull.ashbi.ca {
  reverse_proxy https://127.0.0.1:8443 {
    header_up Host {host}
    transport http {
      tls_insecure_skip_verify
    }
  }
}
lull-relay.ashbi.ca {
  reverse_proxy https://127.0.0.1:8443 {
    header_up Host {host}
    transport http {
      tls_insecure_skip_verify
    }
  }
}

splash.ashbi.ca {
    encode gzip zstd
    reverse_proxy 127.0.0.1:3042 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        transport http {
            dial_timeout 30s
        }
    }
    log {
        output file /data/splash.ashbi.ca.log {
            roll_size 50mb
            roll_keep 5
        }
    }
}

hub.ashbi.ca {
  reverse_proxy 127.0.0.1:3002
}

markup.ashbi.ca {
    reverse_proxy 127.0.0.1:3030
}

contractions.ashbi.ca {
    reverse_proxy 127.0.0.1:3031
}
relay.ashbi.ca {
    reverse_proxy 127.0.0.1:3032
}
"""

# (alinenasseh + artisan blocks are inlined in the canonical
#  template above so we don't need to extract from the live
#  file. If the team wants to update the alinenasseh block
#  (new headers, log config), update the template here and
#  re-run.)

new = canonical

# Brace balance check
o = new.count("{")
c = new.count("}")
if o != c:
    print("[v68] REFUSING: brace imbalance (open %d, close %d, diff %d)" % (o, c, c - o), file=sys.stderr)
    sys.exit(1)

PATH.write_text(new)
print("[v68] Caddyfile rewritten (open %d, close %d)" % (o, c))

# Validate before restarting
result = subprocess.run(
    ["caddy", "validate", "--config", str(PATH)],
    capture_output=True, text=True, timeout=10,
)
if result.returncode != 0:
    print("[v68] caddy validate FAILED:", file=sys.stderr)
    print(result.stderr[-500:], file=sys.stderr)
    sys.exit(1)
print("[v68] caddy validate OK")

# Restart
result = subprocess.run(
    ["systemctl", "restart", "caddy"],
    capture_output=True, text=True, timeout=15,
)
if result.returncode != 0:
    print("[v68] caddy restart failed:", file=sys.stderr)
    print(result.stderr[-300:], file=sys.stderr)
    sys.exit(1)
print("[v68] caddy restarted OK")
