@echo off
setlocal

if "%~1"=="" goto :usage

npm run media:package -- %*
exit /b %errorlevel%

:usage
echo Usage: scripts\publish-hls.cmd ^<input.mp4^> ^<video-id^> ^<gcs-prefix^>
echo Example: scripts\publish-hls.cmd .\input.mp4 P4CVavsbo6w gs://inkengine-dispatch-media/videos
exit /b 1