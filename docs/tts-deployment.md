# Doubao TTS Deployment Notes

This project can use Volcengine Doubao TTS 2.0 for sponsor voice alerts.

Do not commit a real API key into this repository. Replace `<DOUBAO_API_KEY>` with the key from the Volcengine console when running the commands.

## Required Variables

| Variable | Value |
| --- | --- |
| `DOUBAO_TTS_ENABLED` | `true` |
| `DOUBAO_TTS_API_KEY` | `<DOUBAO_API_KEY>` |
| `DOUBAO_TTS_RESOURCE_ID` | `seed-tts-2.0` |
| `DOUBAO_TTS_VOICE_TYPE` | `zh_female_jiaochuannv_uranus_bigtts` |
| `DOUBAO_TTS_TIMEOUT_MS` | `7000` |

## Local Windows Setup

Run these commands in PowerShell or Command Prompt:

```bat
setx DOUBAO_TTS_ENABLED "true"
setx DOUBAO_TTS_API_KEY "<DOUBAO_API_KEY>"
setx DOUBAO_TTS_RESOURCE_ID "seed-tts-2.0"
setx DOUBAO_TTS_VOICE_TYPE "zh_female_jiaochuannv_uranus_bigtts"
setx DOUBAO_TTS_TIMEOUT_MS "7000"
```

After changing `setx` variables, close the old server window and start the server again:

```bat
npm.cmd run dev
```

Or double-click:

```text
start-server.bat
```

## Cloud Linux Setup

For the current cloud deployment under `/opt/sponsor-overlay`, use:

```bash
cd /opt/sponsor-overlay && DOUBAO_TTS_ENABLED=true DOUBAO_TTS_API_KEY='<DOUBAO_API_KEY>' DOUBAO_TTS_RESOURCE_ID='seed-tts-2.0' DOUBAO_TTS_VOICE_TYPE='zh_female_jiaochuannv_uranus_bigtts' DOUBAO_TTS_TIMEOUT_MS=7000 pm2 restart sponsor-overlay --update-env
```

Check logs:

```bash
pm2 logs sponsor-overlay --lines 30
```

The startup log should contain:

```text
doubaoTtsEnabled:true
```

When a sponsor is added successfully, logs should contain:

```text
doubao speech started
doubao speech ready
primary speech selected
```

The generated speech URL should look like:

```text
/speech/<sponsor-id>-doubao.mp3
```

## Full Cloud Update Flow

Use this when uploading a new `sponsor-overlay-server-package.zip`:

```bash
cd /opt/sponsor-overlay
cp -a data /root/sponsor-overlay-data-backup-$(date +%Y%m%d%H%M%S)
unzip -o /root/sponsor-overlay-server-package.zip -d /opt/sponsor-overlay
npm ci --omit=dev
DOUBAO_TTS_ENABLED=true DOUBAO_TTS_API_KEY='<DOUBAO_API_KEY>' DOUBAO_TTS_RESOURCE_ID='seed-tts-2.0' DOUBAO_TTS_VOICE_TYPE='zh_female_jiaochuannv_uranus_bigtts' DOUBAO_TTS_TIMEOUT_MS=7000 pm2 restart sponsor-overlay --update-env
pm2 list
```

## Browser Audio Unlock

OBS browser source can play the Doubao MP3 directly. Normal desktop browsers may require one click before they allow page-triggered audio playback.

For normal browsers, the page shows an `Enable Doubao voice` button. Click it once before testing sponsor alerts. OBS browser source hides this button when OBS is detected.

## Security Note

If a real API key is accidentally pasted into chat, logs, or a repository, rotate it in the Volcengine console and update the environment variable with the new key.
