@echo off
setlocal

if "%~1"=="" goto :usage

npm run media:publish -- %*
exit /b %errorlevel%

:usage
echo Usage: scripts\publish-media.cmd ^<input.mp4^> ^<video-id^> ^<metadata.json^> ^<gcs-prefix^>
echo Example: scripts\publish-media.cmd .\input.mp4 hosted-clip-1 .\clip.json gs://inkengine-dispatch-media/videos
exit /b 1