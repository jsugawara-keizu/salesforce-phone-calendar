# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 1.2.0 (2026-03-27)

### ✨ Features

- 権限セット `PhoneCalendarUser` を追加（Apex・Event・User・PhoneCalendarPref\_\_c）
- カスタム権限 `UsePhoneCalendar` を追加し、権限セットに付与
- LWC: カスタム権限の有無で権限チェックを実施、未付与ユーザーには「権限がありません」を表示
- App Builder プロパティ（`workStartHour` / `workEndHour`）の label・description をカスタムラベル化（多言語対応）

### 📚 Docs

- モバイル専用 Lightning アプリ配置手順・権限セット説明を README に追加

## 1.1.0 (2026-03-27)

### ✨ Features

- PhoneCalendar LWC — initial commit ([6516e81](https://github.com/jsugawara-keizu/phoneCal/commit/6516e81fd93c39d02444c505551e40196f4a0ab2))
