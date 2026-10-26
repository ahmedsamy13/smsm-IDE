# Personal IDE recovery — 26 October 2026

Working copy: C:\Users\smsm\Documents\PersonalIDE-recovery

The deleted D:\my IDE directory was not found in the Recycle Bin. This working copy was reconstructed from the GitHub source commit and 13 later recorded edit patches. The original D: drive was not written to during recovery.

Recovered features include the built-in Codex sidebar, bulk edit acceptance, local chat history, and the project folder picker for new chats. The pinned VSCodium runtime was downloaded and checksum-verified; the official bundled Codex runtime was restored.

The existing PersonalIDE user profile was preserved, with a separate backup under .local\preserved-user-data. History references for the deleted sample workspace were redirected to the recovered sample workspace. The latest available local-editor version of examples\foundation-sandbox\app.js was restored.

Workflow extensions use %LOCALAPPDATA%\PersonalIDE-Extensions. The previous extensions directory remains preserved.

Old generated Windows installer executables and any unrecorded files that had no backup were not recovered. A separate source archive is saved at C:/Users/smsm/Documents/PersonalIDE-source-backup-2026-10-26.zip. Desktop startup automation timed out; the real desktop launch was verified from its running window title and Codex extension startup log.

Use the Personal IDE desktop shortcut, or double-click Launch Personal IDE.cmd here. If Windows asks whether you trust the recovered project folder, review and answer that prompt.
