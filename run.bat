@echo off
REM Dev-only fast launcher - runs from source without an SEA build.
REM Requires Node.js installed. NOT for end-user distribution.
REM End-user builds (no Node.js required) come from `npm run build` (dist/).
node "%~dp0bin\claudetower.js" %*
