# vLLM-MLX OCR Server (Mac Mini)

Self-hosted OCR inference server running on a Mac Mini (Apple Silicon, 16GB), exposed to production via Cloudflare Tunnel.

## Architecture

```
Production worker (Railway)
  → https://ocr.alergant.us (Cloudflare Tunnel)
    → cloudflared on Mac Mini
      → http://localhost:8091 (vllm-mlx)
```

## Host

- **Machine**: Mac Mini, Apple Silicon, 16GB unified memory
- **User**: `belvedere@macmini`
- **Working directory**: `/Users/belvedere/ShelfBeam-serving/`

## Components

### vLLM-MLX (port 8091)

Serves `mlx-community/PaddleOCR-VL-1.5-bf16` via an OpenAI-compatible API.

```bash
/Users/belvedere/ShelfBeam-serving/venv/bin/vllm-mlx serve \
  mlx-community/PaddleOCR-VL-1.5-bf16 \
  --port 8091 \
  --host 0.0.0.0 \
  --continuous-batching \
  --max-tokens 256 \
  --api-key $MLX_OCR_API_KEY
```

- **vllm-mlx version**: 0.2.6
- **Python**: 3.11 (Homebrew)
- **Virtualenv**: `/Users/belvedere/ShelfBeam-serving/venv/`
- **Model cache**: `~/.cache/huggingface/hub/models--mlx-community--PaddleOCR-VL-1.5-bf16/`
- **Logs**: `/Users/belvedere/ShelfBeam-serving/logs/vllm-mlx.log`

### Cloudflare Tunnel

Routes `ocr.alergant.us` to the local vLLM-MLX server.

- **Tunnel name**: `shelfbeam-ocr`
- **Config**: `~/.cloudflared/config.yml`
- **Credentials**: `~/.cloudflared/<tunnel-id>.json`
- **Logs**: `/Users/belvedere/ShelfBeam-serving/logs/cloudflared.err`

Config (`~/.cloudflared/config.yml`):
```yaml
tunnel: <tunnel-id>
credentials-file: /Users/belvedere/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: ocr.alergant.us
    service: http://localhost:8091
  - service: http_status:404
```

### Keepalive Cron

A cron job pings the server every 3 minutes to prevent macOS from swapping/compressing the model's GPU memory pages during inactivity. Without this, the first request after idle can take 10-12s instead of <1s.

- **Script**: `/Users/belvedere/ShelfBeam-serving/keepalive.sh`
- **Schedule**: `*/3 * * * *`

## Environment Variables

File: `/Users/belvedere/ShelfBeam-serving/.env`

```
MLX_OCR_MODEL=mlx-community/PaddleOCR-VL-1.5-bf16
MLX_OCR_PORT=8090          # note: actual server runs on 8091
MLX_OCR_API_KEY=<secret>
```

The API key is also set in the Railway `worker` service as the auth token for OCR requests.

## Starting Services

Both processes were started manually and reparented to launchd (PPID 1). They are **not** managed by launchd plists or any process supervisor. If the Mac Mini reboots or a process crashes, they must be restarted manually.

```bash
# Start vllm-mlx (from ShelfBeam-serving dir)
cd /Users/belvedere/ShelfBeam-serving
source venv/bin/activate
nohup vllm-mlx serve mlx-community/PaddleOCR-VL-1.5-bf16 \
  --port 8091 --host 0.0.0.0 \
  --continuous-batching --max-tokens 256 \
  --api-key "$MLX_OCR_API_KEY" \
  > logs/vllm-mlx.log 2>&1 &

# Start cloudflared
nohup cloudflared tunnel run \
  > logs/cloudflared.log 2>> logs/cloudflared.err &
```

## macOS Tuning

Applied to reduce cold-start latency caused by memory pressure:

- **powernap disabled**: `sudo pmset -a powernap 0` — prevents background activity from churning memory during idle
- **sleep disabled**: `sleep 0` is already set in pmset

## Troubleshooting

### Slow first request after inactivity

The 16GB Mac Mini runs under memory pressure. macOS compresses/swaps MLX Metal memory pages when idle. The keepalive cron mitigates this. If latency spikes return:

1. Check swap: `sysctl vm.swapusage` — used should be < 1GB ideally
2. Check free pages: `memory_pressure` — "Pages free" below 5000 is tight
3. Check keepalive cron is running: `crontab -l | grep keepalive`
4. Tighten keepalive interval to `*/1 * * * *` if needed

### Warm vs cold latency

| State | Latency (7 tokens) |
|-------|-------------------|
| Warm (back-to-back) | ~0.7s (9-10 tok/s) |
| Lukewarm (few min idle) | ~4-5s |
| Cold (10+ min idle, no keepalive) | ~10-12s |

### Process died

Check if processes are running:
```bash
ps aux | grep vllm-mlx
ps aux | grep cloudflared
```

Restart using the commands in "Starting Services" above.

### Tunnel not connecting

```bash
cloudflared tunnel info shelfbeam-ocr   # check connections
cloudflared tunnel list                  # verify tunnel exists
```

### Testing the endpoint

```bash
# Local test
curl -X POST http://localhost:8091/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MLX_OCR_API_KEY" \
  -d '{"model": "mlx-community/PaddleOCR-VL-1.5-bf16", "prompt": "hi", "max_tokens": 1}'

# Production test (via tunnel)
curl -X POST https://ocr.alergant.us/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MLX_OCR_API_KEY" \
  -d '{"model": "mlx-community/PaddleOCR-VL-1.5-bf16", "prompt": "hi", "max_tokens": 1}'
```
