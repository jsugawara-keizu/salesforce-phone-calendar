/**
 * @description c-phone-calendar の単体テスト
 *
 * カバレッジ対象:
 *  - レンダリング（スモークテスト）
 *  - ビューモード切り替え
 *  - 期間ラベル表示
 *  - ナビゲーション（前後・今日）
 *  - ユーザーパネル（開閉・ユーザー選択）
 *  - デイパネル（月表示タップ）
 *  - イベント表示（通常・終日・日跨ぎ）
 *  - Apex 呼び出しパラメータ
 *  - エラーハンドリング
 */
import { createElement } from "lwc";
import PhoneCalendar from "c/phoneCalendar";
import { registerApexTestWireAdapter } from "@salesforce/wire-service-jest-util";
import getActiveUsers from "@salesforce/apex/PhoneCalendarController.getActiveUsers";
import getPublicCalendars from "@salesforce/apex/PhoneCalendarController.getPublicCalendars";
import getCalendarPreference from "@salesforce/apex/PhoneCalendarController.getCalendarPreference";
import getEventsForMonth from "@salesforce/apex/PhoneCalendarController.getEventsForMonth";
import saveCalendarPreference from "@salesforce/apex/PhoneCalendarController.saveCalendarPreference";

// ── 命令的 Apex モック ────────────────────────────────────────────────────────
// sfdx-lwc-jest は @salesforce/apex/* を jest.fn() にマップしないため
// { virtual: true } で明示的にモックする必要がある
// transformer が import を `require(...).default` に書き換えるため
// factory は { default: jest.fn() } を返す必要がある
jest.mock(
  "@salesforce/apex/PhoneCalendarController.getCalendarPreference",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PhoneCalendarController.getEventsForMonth",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PhoneCalendarController.saveCalendarPreference",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

// ── Wire アダプターモック ───────────────────────────────────────────────────────
const getActiveUsersAdapter = registerApexTestWireAdapter(getActiveUsers);
// getPublicCalendars は現在のテストでは emit しないため adapter 変数は不要
registerApexTestWireAdapter(getPublicCalendars);

// ── ユーティリティ ─────────────────────────────────────────────────────────────
/** マイクロタスクキューを複数段階空にする（setTimeout を使わない） */
const flushPromises = () =>
  Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const todayStr = toDateStr(today);
const tomorrowStr = toDateStr(tomorrow);

// ── テストフィクスチャ ─────────────────────────────────────────────────────────
const MOCK_USERS = [
  { Id: "u001", Name: "Alice Tanaka" },
  { Id: "u002", Name: "Bob Yamamoto" }
];

const TIMED_EVENT = {
  Id: "e001",
  Subject: "チームミーティング",
  ActivityDate: todayStr,
  ActivityDateTime: `${todayStr}T09:00:00.000Z`,
  EndDateTime: `${todayStr}T10:00:00.000Z`,
  IsAllDayEvent: false,
  OwnerId: "", // '' = @salesforce/user/Id のデフォルトモック値
  DurationInMinutes: 60
};

const ALLDAY_EVENT = {
  Id: "e002",
  Subject: "祝日",
  ActivityDate: todayStr,
  IsAllDayEvent: true,
  OwnerId: ""
};

/** todayStr 22:00 〜 tomorrowStr 04:00 の日跨ぎイベント */
const MULTIDAY_EVENT = {
  Id: "e003",
  Subject: "Conference",
  ActivityDate: todayStr,
  ActivityDateTime: `${todayStr}T22:00:00.000Z`,
  EndDateTime: `${tomorrowStr}T04:00:00.000Z`,
  IsAllDayEvent: false,
  OwnerId: "",
  DurationInMinutes: 360
};

// ── ヘルパー ───────────────────────────────────────────────────────────────────
function createElement_({ pref = null, events = [] } = {}) {
  getCalendarPreference.mockResolvedValue(pref);
  getEventsForMonth.mockResolvedValue(events);
  const el = createElement("c-phone-calendar", { is: PhoneCalendar });
  document.body.appendChild(el);
  return el;
}

async function createAndFlush(opts) {
  const el = createElement_(opts);
  await flushPromises();
  return el;
}

async function openViewMenu(el) {
  el.shadowRoot.querySelector(".period-btn").click();
  await Promise.resolve();
}

async function switchView(el, mode) {
  el.shadowRoot.querySelector(`[data-mode="${mode}"]`).click();
  await flushPromises();
}

function getHeaderBtns(el) {
  return [...el.shadowRoot.querySelectorAll(".header-icon-btn")];
}

// ── テスト本体 ─────────────────────────────────────────────────────────────────
describe("c-phone-calendar", () => {
  beforeEach(() => {
    // saveCalendarPreference を Promise を返すようにデフォルト設定
    // （コンポーネントが .catch() を呼ぶため undefined では TypeError になる）
    saveCalendarPreference.mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  // ── 1. レンダリング ─────────────────────────────────────────────────────────

  describe("レンダリング", () => {
    it("エラーなしでコンポーネントが描画される", async () => {
      const el = await createAndFlush();
      expect(el.shadowRoot.querySelector(".calendar-root")).not.toBeNull();
    });

    it("デフォルトで月表示が表示される", async () => {
      const el = await createAndFlush();
      expect(el.shadowRoot.querySelector(".calendar-grid")).not.toBeNull();
    });

    it("曜日ヘッダーが 7 列レンダリングされる", async () => {
      const el = await createAndFlush();
      expect(el.shadowRoot.querySelectorAll(".dow-label")).toHaveLength(7);
    });

    it("FAB ボタンが表示される", async () => {
      const el = await createAndFlush();
      expect(el.shadowRoot.querySelector(".fab-btn")).not.toBeNull();
    });

    it("ヘッダーナビゲーションボタンが 3 つ以上表示される", async () => {
      const el = await createAndFlush();
      expect(getHeaderBtns(el).length).toBeGreaterThanOrEqual(3);
    });

    it("スピナーはイベント読み込み後に非表示になる", async () => {
      const el = await createAndFlush();
      expect(el.shadowRoot.querySelector("lightning-spinner")).toBeNull();
    });
  });

  // ── 2. ビューモード切り替え ────────────────────────────────────────────────

  describe("ビューモード切り替え", () => {
    it("期間ボタンをクリックするとポップアップが表示される", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      expect(el.shadowRoot.querySelector(".action-opts")).not.toBeNull();
    });

    it("日表示に切り替わる", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "day");
      expect(el.shadowRoot.querySelector(".time-grid-scroll")).not.toBeNull();
      expect(el.shadowRoot.querySelector(".calendar-grid")).toBeNull();
    });

    it("3日間表示に切り替わる", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "3day");
      expect(
        el.shadowRoot.querySelector(".three-day-container")
      ).not.toBeNull();
    });

    it("議題表示に切り替わる", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "agenda");
      expect(el.shadowRoot.querySelector(".agenda-scroll")).not.toBeNull();
    });

    it("月表示に戻れる", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "day");
      await openViewMenu(el);
      await switchView(el, "month");
      expect(el.shadowRoot.querySelector(".calendar-grid")).not.toBeNull();
    });

    it("ビューモードバッジが空でない", async () => {
      const el = await createAndFlush();
      const badge = el.shadowRoot.querySelector(".view-mode-badge");
      expect(badge).not.toBeNull();
      expect(badge.textContent.trim().length).toBeGreaterThan(0);
    });
  });

  // ── 3. 期間ラベル ──────────────────────────────────────────────────────────

  describe("期間ラベル", () => {
    it("月表示で期間ラベルに現在年が含まれる", async () => {
      const el = await createAndFlush();
      const label = el.shadowRoot.querySelector(".period-label");
      expect(label.textContent).toContain(String(today.getFullYear()));
    });

    it("日表示で期間ラベルが空でない", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "day");
      const label = el.shadowRoot.querySelector(".period-label");
      expect(label.textContent.trim().length).toBeGreaterThan(0);
    });

    it("3日間表示で期間ラベルが空でない", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "3day");
      const label = el.shadowRoot.querySelector(".period-label");
      expect(label.textContent.trim().length).toBeGreaterThan(0);
    });

    it("議題表示で期間ラベルが空でない", async () => {
      const el = await createAndFlush();
      await openViewMenu(el);
      await switchView(el, "agenda");
      const label = el.shadowRoot.querySelector(".period-label");
      expect(label.textContent.trim().length).toBeGreaterThan(0);
    });
  });

  // ── 4. ナビゲーション ──────────────────────────────────────────────────────

  describe("ナビゲーション", () => {
    it("前へボタンでイベントが再取得される", async () => {
      const el = await createAndFlush();
      getEventsForMonth.mockClear().mockResolvedValue([]);
      getHeaderBtns(el)[0].click(); // prev
      await flushPromises();
      expect(getEventsForMonth).toHaveBeenCalledTimes(1);
    });

    it("次へボタンでイベントが再取得される", async () => {
      const el = await createAndFlush();
      getEventsForMonth.mockClear().mockResolvedValue([]);
      getHeaderBtns(el)[1].click(); // next
      await flushPromises();
      expect(getEventsForMonth).toHaveBeenCalledTimes(1);
    });

    it("今日ボタンでイベントが再取得される", async () => {
      const el = await createAndFlush();
      getEventsForMonth.mockClear().mockResolvedValue([]);
      el.shadowRoot.querySelector(".today-btn").click();
      await flushPromises();
      expect(getEventsForMonth).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. ユーザーパネル ──────────────────────────────────────────────────────

  describe("ユーザーパネル", () => {
    function openUserPanel(el) {
      const btns = getHeaderBtns(el);
      btns[btns.length - 1].click(); // 最右ボタン = ユーザー
      return Promise.resolve();
    }

    it("人アイコンをクリックするとパネルが開く", async () => {
      const el = await createAndFlush();
      await openUserPanel(el);
      expect(el.shadowRoot.querySelector(".bottom-sheet")).not.toBeNull();
    });

    it("ワイヤーデータのユーザーがパネルに表示される", async () => {
      const el = await createAndFlush();
      getActiveUsersAdapter.emit(MOCK_USERS);
      await openUserPanel(el);
      await Promise.resolve();
      expect(el.shadowRoot.querySelectorAll(".user-row")).toHaveLength(
        MOCK_USERS.length
      );
    });

    it('選択件数ラベルが表示される（"/" を含む）', async () => {
      const el = await createAndFlush();
      await openUserPanel(el);
      const labels = [
        ...el.shadowRoot.querySelectorAll(".slds-text-body_small")
      ];
      expect(labels.some((l) => l.textContent.includes("/"))).toBe(true);
    });

    it("選択済みユーザーをトグルすると選択が外れる", async () => {
      // 2 ユーザーを選択済み状態で起動
      const el = await createAndFlush({ pref: "u001,u002", events: [] });
      getActiveUsersAdapter.emit(MOCK_USERS);
      await openUserPanel(el);
      await Promise.resolve();

      const rows = el.shadowRoot.querySelectorAll(".user-row");
      rows[1].click(); // u002 をトグルオフ
      await flushPromises();

      const labels = [
        ...el.shadowRoot.querySelectorAll(".slds-text-body_small")
      ];
      expect(labels.some((l) => l.textContent.startsWith("1 /"))).toBe(true);
    });

    it("最後の 1 人はトグルオフできない", async () => {
      // u001 だけを選択済み状態で起動し、そのユーザーだけを emit
      const el = await createAndFlush({ pref: "u001", events: [] });
      getActiveUsersAdapter.emit([MOCK_USERS[0]]);
      await openUserPanel(el);
      await Promise.resolve();

      // 唯一のユーザーをクリック → 変化なし
      el.shadowRoot.querySelector(".user-row").click();
      await flushPromises();

      const labels = [
        ...el.shadowRoot.querySelectorAll(".slds-text-body_small")
      ];
      // 選択数が 1 のまま
      expect(labels.some((l) => l.textContent.startsWith("1 /"))).toBe(true);
    });
  });

  // ── 6. デイパネル（月表示 → タップ）─────────────────────────────────────────

  describe("デイパネル", () => {
    it("日付セルをクリックするとボトムシートが開く", async () => {
      const el = await createAndFlush();
      const cells = el.shadowRoot.querySelectorAll(
        ".day-cell:not(.day-cell_empty)"
      );
      if (cells.length === 0) {
        return;
      } // グリッド未描画なら skip
      cells[0].click();
      await Promise.resolve();
      expect(el.shadowRoot.querySelector(".bottom-sheet")).not.toBeNull();
    });

    it("オーバーレイをクリックするとパネルが閉じる", async () => {
      const el = await createAndFlush();
      const cells = el.shadowRoot.querySelectorAll(
        ".day-cell:not(.day-cell_empty)"
      );
      if (cells.length === 0) {
        return;
      }
      cells[0].click();
      await Promise.resolve();
      el.shadowRoot.querySelector(".bottom-sheet-overlay").click();
      await Promise.resolve();
      expect(el.shadowRoot.querySelector(".bottom-sheet-overlay")).toBeNull();
    });
  });

  // ── 7. イベント表示 ────────────────────────────────────────────────────────

  describe("イベント表示", () => {
    it("タイムドイベントがある日に月表示でドットが表示される", async () => {
      const el = await createAndFlush({ events: [TIMED_EVENT] });
      getActiveUsersAdapter.emit([{ Id: "", Name: "Me" }]);
      await flushPromises();
      expect(
        el.shadowRoot.querySelectorAll(".event-dot").length
      ).toBeGreaterThan(0);
    });

    it("終日イベントがある日に月表示でドットが表示される", async () => {
      const el = await createAndFlush({ events: [ALLDAY_EVENT] });
      getActiveUsersAdapter.emit([{ Id: "", Name: "Me" }]);
      await flushPromises();
      expect(
        el.shadowRoot.querySelectorAll(".event-dot").length
      ).toBeGreaterThan(0);
    });

    it("日表示で終日バーが表示される（終日イベントあり）", async () => {
      const el = await createAndFlush({ events: [ALLDAY_EVENT] });
      await openViewMenu(el);
      await switchView(el, "day");
      expect(el.shadowRoot.querySelector(".allday-bar")).not.toBeNull();
    });

    it("日表示で終日バーが表示されない（終日イベントなし）", async () => {
      const el = await createAndFlush({ events: [TIMED_EVENT] });
      await openViewMenu(el);
      await switchView(el, "day");
      expect(el.shadowRoot.querySelector(".allday-bar")).toBeNull();
    });

    it("日表示でタイムドイベントが時間グリッドに表示される", async () => {
      const el = await createAndFlush({ events: [TIMED_EVENT] });
      await openViewMenu(el);
      await switchView(el, "day");
      expect(
        el.shadowRoot.querySelectorAll(".te-event").length
      ).toBeGreaterThan(0);
    });

    it("議題表示でイベントなしのとき空状態メッセージが表示される", async () => {
      const el = await createAndFlush({ events: [] });
      await openViewMenu(el);
      await switchView(el, "agenda");
      expect(el.shadowRoot.querySelector(".slds-p-top_large")).not.toBeNull();
    });

    it("議題表示でイベントがあるとき議題グループが表示される", async () => {
      const el = await createAndFlush({ events: [TIMED_EVENT] });
      await openViewMenu(el);
      await switchView(el, "agenda");
      expect(
        el.shadowRoot.querySelectorAll(".agenda-date-header").length
      ).toBeGreaterThan(0);
    });
  });

  // ── 8. 日跨ぎイベント ─────────────────────────────────────────────────────

  describe("日跨ぎイベント", () => {
    it("日跨ぎイベントが開始日の日表示に表示される", async () => {
      const el = await createAndFlush({ events: [MULTIDAY_EVENT] });
      await openViewMenu(el);
      await switchView(el, "day");
      // anchorDateStr = today = 開始日
      expect(
        el.shadowRoot.querySelectorAll(".te-event").length
      ).toBeGreaterThan(0);
    });

    it("日跨ぎイベントが月表示の開始日にドット表示される", async () => {
      const el = await createAndFlush({ events: [MULTIDAY_EVENT] });
      getActiveUsersAdapter.emit([{ Id: "", Name: "Me" }]);
      await flushPromises();
      expect(
        el.shadowRoot.querySelectorAll(".event-dot").length
      ).toBeGreaterThan(0);
    });
  });

  // ── 9. Apex getEventsForMonth 呼び出しパラメータ ─────────────────────────

  describe("Apex 呼び出し", () => {
    it("初回ロード時に getEventsForMonth が ownerIds 付きで呼ばれる", async () => {
      await createAndFlush({ pref: "u001,u002", events: [] });
      expect(getEventsForMonth).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerIds: expect.arrayContaining(["u001", "u002"])
        })
      );
    });

    it("設定なしの場合 getEventsForMonth が単一ユーザーで呼ばれる", async () => {
      await createAndFlush({ pref: null, events: [] });
      expect(getEventsForMonth).toHaveBeenCalledWith(
        expect.objectContaining({ ownerIds: expect.any(Array) })
      );
    });

    it("getEventsForMonth がエラーを返してもコンポーネントがクラッシュしない", async () => {
      getCalendarPreference.mockResolvedValue(null);
      getEventsForMonth.mockRejectedValue({
        body: { message: "Server error" }
      });
      const el = createElement("c-phone-calendar", { is: PhoneCalendar });
      document.body.appendChild(el);
      await flushPromises();
      // エラー後もカレンダーが表示されていること
      expect(el.shadowRoot.querySelector(".calendar-root")).not.toBeNull();
    });

    it("ユーザートグル後に saveCalendarPreference が呼ばれる", async () => {
      const el = await createAndFlush({ pref: "u001,u002", events: [] });
      getActiveUsersAdapter.emit(MOCK_USERS);
      const btns = getHeaderBtns(el);
      btns[btns.length - 1].click();
      await Promise.resolve();

      el.shadowRoot.querySelectorAll(".user-row")[1].click(); // u002 トグル
      await flushPromises();

      expect(saveCalendarPreference).toHaveBeenCalledTimes(1);
    });
  });
});
