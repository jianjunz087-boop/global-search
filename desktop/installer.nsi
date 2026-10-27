Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
Name "BAIHUA AI TRADE"
InstallDir "$LOCALAPPDATA\Programs\BAIHUA AI TRADE"
InstallDirRegKey HKCU "Software\BAIHUA AI TRADE" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\BAIHUA AI TRADE.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch BAIHUA AI TRADE"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK "This package requires 64-bit Windows 10 or 11."
    Abort
  ${EndIf}
FunctionEnd
Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  !ifdef NSIS_WIN32_MAKENSIS
    File /r "${PROJECT_DIR}\dist\windows\win-unpacked\*"
  !else
    File /r "${PROJECT_DIR}/dist/windows/win-unpacked/*"
  !endif
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\BAIHUA AI TRADE"
  CreateShortcut "$SMPROGRAMS\BAIHUA AI TRADE\BAIHUA AI TRADE.lnk" "$INSTDIR\BAIHUA AI TRADE.exe"
  CreateShortcut "$DESKTOP\BAIHUA AI TRADE.lnk" "$INSTDIR\BAIHUA AI TRADE.exe"
  WriteRegStr HKCU "Software\BAIHUA AI TRADE" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BAIHUA AI TRADE" "DisplayName" "BAIHUA AI TRADE"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BAIHUA AI TRADE" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BAIHUA AI TRADE" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BAIHUA AI TRADE" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BAIHUA AI TRADE" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\BAIHUA AI TRADE.lnk"
  RMDir /r "$SMPROGRAMS\BAIHUA AI TRADE"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\BAIHUA AI TRADE"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BAIHUA AI TRADE"
  ; Retain the user's database and encrypted key in AppData.
SectionEnd
