# PhoneCalendar — Salesforce Mobile App 向けカレンダー LWC

月・日・3日間・議題 の4ビューを持つ、iPhone（Salesforce Mobile App）最適化カレンダーコンポーネント。
複数ユーザー・公開／リソースカレンダーの横断表示、日跨ぎイベント、i18n 対応（日本語 / 英語）。

---

## 機能一覧

| 機能             | 詳細                                                             |
| ---------------- | ---------------------------------------------------------------- |
| 月表示           | 週単位グリッド、イベントドット（最大3色）、タップでデイパネル    |
| 日表示           | 時間グリッド、重複イベント自動レイアウト、現在時刻ライン         |
| 3日間表示        | 3カラム時間グリッド                                              |
| 議題表示         | 日付グループリスト、最大60日先まで                               |
| 複数ユーザー     | 最大13名、色分け表示、名前検索フィルター                         |
| 公開＆リソース   | Salesforce Calendar（Type P / R）対応                            |
| 日跨ぎイベント   | 各日の時間グリッドにまたがって表示                               |
| i18n             | Custom Labels + `Intl.DateTimeFormat`、`en_US` 翻訳同梱          |
| App Builder 設定 | `workStartHour` / `workEndHour` でオフアワー色付け範囲を設定可能 |

---

## アーキテクチャ

```
force-app/main/default/
├── lwc/phoneCalendar/
│   ├── phoneCalendar.js          # ビューロジック・Intl・Custom Labels
│   ├── phoneCalendar.html        # テンプレート（{label.xxx} バインド）
│   ├── phoneCalendar.css         # SLDS 2 / ダークモード対応
│   └── phoneCalendar.js-meta.xml # App Builder / モバイル公開設定
├── classes/
│   └── PhoneCalendarController.cls  # Apex: イベント取得・設定保存
├── labels/
│   └── CustomLabels.labels-meta.xml # 33 ラベル（デフォルト: ja）
├── translations/
│   └── en_US.translation-meta.xml  # 英語翻訳
├── permissionsets/
│   └── PhoneCalendarUser.permissionset-meta.xml  # 利用者向け権限セット
└── objects/PhoneCalendarPref__c/    # 階層カスタム設定（選択ユーザー保存）
```

---

## 権限セット

`PhoneCalendarUser` 権限セットをデプロイ後、利用ユーザーに割り当ててください。

| 権限                   | 内容                                     |
| ---------------------- | ---------------------------------------- |
| Apex クラス            | `PhoneCalendarController`（実行）        |
| `PhoneCalendarPref__c` | 作成・参照・編集（カレンダー設定の保存） |
| `Event`                | 作成・参照・編集（イベントの表示・作成） |
| `User`                 | 参照（ユーザー一覧の取得）               |

```bash
# デプロイ
sf project deploy start \
  --source-dir force-app/main/default/permissionsets \
  --target-org <alias>

# ユーザーへの割り当て
sf org assign permset --name PhoneCalendarUser --target-org <alias>
```

---

## 配置手順（モバイル専用 Lightning アプリ）

このコンポーネントは **Salesforce Mobile App 専用**の用途を想定しています。
デスクトップブラウザには表示せず、モバイルアプリのみで利用可能にするには以下の手順で設定します。

### 1. Lightning タブを作成（Tabs）

1. **Setup → Tabs → Lightning Component Tabs → New**
2. Lightning Component: `c:phoneCalendar`
3. タブラベル・名前を設定（例: `PhoneCalendar`）

### 2. モバイル専用 Lightning アプリを作成（App Manager）

1. **Setup → App Manager → New Lightning App**
2. アプリ名を設定（例: `PhoneCalendar`）
3. **Form Factor → Phone のみ**を選択
   → Phone のみを選択した Lightning アプリはデスクトップの App Launcher に表示されません
4. Navigation Style: **Standard Navigation**
5. ナビゲーション項目に手順 1 で作成した **PhoneCalendar タブ**を追加

### 3. Salesforce Mobile App ナビゲーションに追加

**Setup → Salesforce Mobile App Setup → Navigation** で作成したアプリを有効化し、利用ユーザーのプロファイルまたは権限セットでアプリを割り当てます。

---

## セットアップ

### 前提条件

- Node.js 20+
- Salesforce CLI (`@salesforce/cli` latest)
- Dev Hub 有効化済み org

### 1. npm 依存パッケージをインストール

```bash
npm install
```

### 2. 組織にデプロイ（開発・検証時）

```bash
sf project deploy start --source-dir force-app --target-org <alias>
```

### 3. 2GP Unlocked Package として配布

```bash
# パッケージを作成（初回のみ）
sf package create \
  --name PhoneCalendar \
  --package-type Unlocked \
  --no-namespace \
  --target-dev-hub <hub-alias>

# パッケージバージョンを作成（sfdx-project.json に Package ID が書き込まれます）
sf package version create \
  --package PhoneCalendar \
  --installation-key-bypass \
  --wait 20 \
  --target-dev-hub <hub-alias>

# 対象組織にインストール
sf package install \
  --package "PhoneCalendar@1.0.0-1" \
  --target-org <alias> \
  --wait 10
```

---

## 開発フロー

このプロジェクトは **PR ベースの CI** を採用しています。

```
feature/* ──── PR ────→ main
                  ↓
          GitHub Actions CI
          • ESLint
          • Jest unit tests
          ↑
      CodeRabbit AI レビュー（自動投稿）
```

### 1. フィーチャーブランチを作成

```bash
git checkout -b feature/my-feature
```

### 2. Conventional Commits 形式でコミット

```
feat: 週表示を追加
fix: 日跨ぎイベントのカラー計算を修正
perf: agendaGroups のキャッシュを改善
refactor: layoutEvents を共通化
```

### 3. PR 作成 → CI パス → マージ

PR 作成時に GitHub Actions が Lint + Jest を実行。
CodeRabbit が LWC / Apex のベストプラクティスに基づいた AI コードレビューを自動投稿。

---

## バージョン管理（BumpVersion）

`commit-and-tag-version` を使用して以下をまとめて実行します：

- `package.json` の `version` を semver でインクリメント
- `sfdx-project.json` の `versionNumber` を自動同期（`scripts/sync-sf-version.js`）
- `CHANGELOG.md` を Conventional Commits から自動生成
- git タグ（`v1.x.x`）を作成

```bash
npm run release          # patch: 1.0.0 → 1.0.1
npm run release:minor    # minor: 1.0.0 → 1.1.0
npm run release:major    # major: 1.0.0 → 2.0.0
```

> 初回は `npm install` 後に利用可能です。

| ファイル            | 管理内容                             |
| ------------------- | ------------------------------------ |
| `package.json`      | npm semver バージョン                |
| `sfdx-project.json` | `versionNumber`（`1.x.x.NEXT` 形式） |
| `CHANGELOG.md`      | 自動生成（Conventional Commits）     |
| git tag             | `v1.x.x`                             |

---

## 変更履歴

### v1.2.0 — 2026-03-27

#### ✨ Features

- 権限セット `PhoneCalendarUser` を追加（Apex・オブジェクト権限をまとめて付与）

#### 📚 Docs

- モバイル専用 Lightning アプリとしての配置手順を README に追加
- 権限セットのデプロイ・割り当て手順を README に追加

---

### v1.1.0 — 2026-03-27

#### 🛠 CI / 開発基盤

- Apex ユニットテスト（`PhoneCalendarControllerTest.cls`）追加
- LWC Jest ユニットテスト（`phoneCalendar.test.js`）追加
- GitHub Actions CI（Lint + Jest、PR 時に自動実行）設定

---

### v1.0.0 — 2026-03-27

**初回リリース**

#### ✨ Features

- 月・日・3日間・議題 の4ビュー実装
- 複数ユーザー表示（最大13名）・イベントカラー分け
- ユーザー名検索フィルター
- 公開＆リソースカレンダー（Salesforce Calendar Type P / R）表示
- 日跨ぎタイムドイベント対応（各日の時間グリッドにクリップ表示）
- App Builder 設定項目（`workStartHour` / `workEndHour`）
- Custom Labels + `Intl.DateTimeFormat` による i18n（日本語・英語）
- ユーザー設定を `PhoneCalendarPref__c` 階層カスタム設定に保存

#### 🛠 CI / 開発基盤

- GitHub Actions CI（Lint + Jest、PR 時に自動実行）
- CodeRabbit AI コードレビュー設定
- 2GP Unlocked Package 配布設定（`sfdx-project.json`）
- BumpVersion（`commit-and-tag-version`）設定
- Husky + lint-staged プリコミットフック
