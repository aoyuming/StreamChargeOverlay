# 豆包 TTS 部署说明

这个项目支持使用火山引擎 Doubao TTS 2.0 作为赞助语音播报。

不要把真实的 API Key 提交到仓库里。运行命令时，把 `<DOUBAO_API_KEY>` 替换成你在火山控制台拿到的真实 key。

## 必填环境变量

| 变量名 | 值 |
| --- | --- |
| `DOUBAO_TTS_ENABLED` | `true` |
| `DOUBAO_TTS_API_KEY` | `<DOUBAO_API_KEY>` |
| `DOUBAO_TTS_RESOURCE_ID` | `seed-tts-2.0` |
| `DOUBAO_TTS_VOICE_TYPE` | `zh_female_jiaochuannv_uranus_bigtts` |
| `DOUBAO_TTS_TIMEOUT_MS` | `7000` |

## 本地 Windows 配置

在 PowerShell 或命令提示符里执行：

```bat
setx DOUBAO_TTS_ENABLED "true"
setx DOUBAO_TTS_API_KEY "<DOUBAO_API_KEY>"
setx DOUBAO_TTS_RESOURCE_ID "seed-tts-2.0"
setx DOUBAO_TTS_VOICE_TYPE "zh_female_jiaochuannv_uranus_bigtts"
setx DOUBAO_TTS_TIMEOUT_MS "7000"
```

修改完 `setx` 变量后，要关掉旧的服务器窗口，再重新启动：

```bat
npm.cmd run dev
```

或者直接双击：

```text
start-server.bat
```

## 云端 Linux 配置

当前云端部署目录是 `/opt/sponsor-overlay`，可直接执行：

```bash
cd /opt/sponsor-overlay && DOUBAO_TTS_ENABLED=true DOUBAO_TTS_API_KEY='<DOUBAO_API_KEY>' DOUBAO_TTS_RESOURCE_ID='seed-tts-2.0' DOUBAO_TTS_VOICE_TYPE='zh_female_jiaochuannv_uranus_bigtts' DOUBAO_TTS_TIMEOUT_MS=7000 pm2 restart sponsor-overlay --update-env
```

查看日志：

```bash
pm2 logs sponsor-overlay --lines 30
```

启动日志里应该能看到：

```text
doubaoTtsEnabled:true
```

新增赞助成功后，日志里应该能看到：

```text
doubao speech started
doubao speech ready
primary speech selected
```

成功生成的语音地址通常是：

```text
/speech/<sponsor-id>-doubao.mp3
```

## 云端完整更新流程

上传新的 `sponsor-overlay-server-package.zip` 后，可按下面流程更新：

```bash
cd /opt/sponsor-overlay
cp -a data /root/sponsor-overlay-data-backup-$(date +%Y%m%d%H%M%S)
unzip -o /root/sponsor-overlay-server-package.zip -d /opt/sponsor-overlay
npm ci --omit=dev
DOUBAO_TTS_ENABLED=true DOUBAO_TTS_API_KEY='<DOUBAO_API_KEY>' DOUBAO_TTS_RESOURCE_ID='seed-tts-2.0' DOUBAO_TTS_VOICE_TYPE='zh_female_jiaochuannv_uranus_bigtts' DOUBAO_TTS_TIMEOUT_MS=7000 pm2 restart sponsor-overlay --update-env
pm2 list
```

## 浏览器语音启用

OBS 浏览器源可以直接播放豆包 MP3。普通桌面浏览器有时需要先点一次，才允许页面后续自动播放语音。

普通浏览器打开页面后，会看到一个 `启用豆包语音` 按钮。测试前先点一次，后面的豆包语音就能自动播放。检测到是 OBS 浏览器源时，这个按钮会自动隐藏。

## 安全提醒

如果真实 API Key 不小心发到了聊天、日志或仓库里，建议马上去火山控制台重新生成一个新的 key，然后更新环境变量。
