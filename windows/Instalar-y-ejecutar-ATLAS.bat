@echo off
chcp 65001 >nul
title ATLAS-AI - Instalador y servidor
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0Start-ATLAS.ps1"
