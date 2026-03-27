import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { encodeDefaultFieldValues } from 'lightning/pageReferenceUtils';
import loggedInUserId from '@salesforce/user/Id';
import LOCALE from '@salesforce/i18n/locale';
import getActiveUsers from '@salesforce/apex/PhoneCalendarController.getActiveUsers';
import getCalendarPreference from '@salesforce/apex/PhoneCalendarController.getCalendarPreference';
import getEventsForMonth from '@salesforce/apex/PhoneCalendarController.getEventsForMonth';
import getPublicCalendars from '@salesforce/apex/PhoneCalendarController.getPublicCalendars';
import saveCalendarPreference from '@salesforce/apex/PhoneCalendarController.saveCalendarPreference';
import labelAgendaSuffix from '@salesforce/label/c.PhoneCal_AgendaSuffix';
import labelAllDay from '@salesforce/label/c.PhoneCal_AllDay';
import labelClose from '@salesforce/label/c.PhoneCal_Close';
import labelCreate from '@salesforce/label/c.PhoneCal_Create';
import labelDateRangeSep from '@salesforce/label/c.PhoneCal_DateRangeSep';
import labelDisplayUsers from '@salesforce/label/c.PhoneCal_DisplayUsers';
import labelError from '@salesforce/label/c.PhoneCal_Error';
import labelErrorLoad from '@salesforce/label/c.PhoneCal_ErrorLoad';
import labelHours from '@salesforce/label/c.PhoneCal_Hours';
import labelLoading from '@salesforce/label/c.PhoneCal_Loading';
import labelMaxUsersReached from '@salesforce/label/c.PhoneCal_MaxUsersReached';
import labelMinutes from '@salesforce/label/c.PhoneCal_Minutes';
import labelNewEventAlt from '@salesforce/label/c.PhoneCal_NewEventAlt';
import labelNewEventAriaLabel from '@salesforce/label/c.PhoneCal_NewEventAriaLabel';
import labelNextPeriod from '@salesforce/label/c.PhoneCal_NextPeriod';
import labelNoEventsInPeriod from '@salesforce/label/c.PhoneCal_NoEventsInPeriod';
import labelNoEventsOnDay from '@salesforce/label/c.PhoneCal_NoEventsOnDay';
import labelOpenDayView from '@salesforce/label/c.PhoneCal_OpenDayView';
import labelPrevPeriod from '@salesforce/label/c.PhoneCal_PrevPeriod';
import labelSearchPlaceholder from '@salesforce/label/c.PhoneCal_SearchPlaceholder';
import labelSectionPublicResource from '@salesforce/label/c.PhoneCal_SectionPublicResource';
import labelSectionUsers from '@salesforce/label/c.PhoneCal_SectionUsers';
import labelSelectedSuffix from '@salesforce/label/c.PhoneCal_SelectedSuffix';
import labelToday from '@salesforce/label/c.PhoneCal_Today';
import labelTypePublic from '@salesforce/label/c.PhoneCal_TypePublic';
import labelTypeResource from '@salesforce/label/c.PhoneCal_TypeResource';
import labelUserSelectAriaLabel from '@salesforce/label/c.PhoneCal_UserSelectAriaLabel';
import labelView3Day from '@salesforce/label/c.PhoneCal_View3Day';
import labelView3DayBadge from '@salesforce/label/c.PhoneCal_View3DayBadge';
import labelViewAgenda from '@salesforce/label/c.PhoneCal_ViewAgenda';
import labelViewDay from '@salesforce/label/c.PhoneCal_ViewDay';
import labelViewModeAriaLabel from '@salesforce/label/c.PhoneCal_ViewModeAriaLabel';
import labelViewModeTitle from '@salesforce/label/c.PhoneCal_ViewModeTitle';
import labelViewMonth from '@salesforce/label/c.PhoneCal_ViewMonth';

const AGENDA_NAV_DAYS = 14,
    DAYS_PER_WEEK = 7,
    DEFAULT_DURATION_MINUTES = 60,
    DOW_SATURDAY = 6,
    DOW_SUNDAY = 0,
    HOUR_HEIGHT_PX = 60,
    HOURS_IN_DAY = 24,
    MAX_AGENDA_DAYS = 60,
    MAX_EVENT_DOTS = 3,
    MAX_SELECTED_USERS = 13,
    MIN_EVENT_HEIGHT_PX = 24,
    MS_PER_MINUTE = 60000,
    PAD_CHAR = '0',
    PAD_LENGTH = 2,
    PX_PER_MINUTE = 1,
    RADIX_DECIMAL = 10,
    SHEET_SWIPE_THRESHOLD = 60,
    SHOW_META_MIN_HEIGHT = 40,
    SWIPE_THRESHOLD = 50,
    THREE_DAY_OFFSET = 2,
    THREE_DAY_STEP = 3,
    TIME_GRID_TOTAL_PX = 1440;

const USER_COLORS = [
    { bg: '#d8edff', border: '#0176d3' },
    { bg: '#fde8e8', border: '#c23934' },
    { bg: '#d4f5dd', border: '#27ae60' },
    { bg: '#fff3cd', border: '#f39c12' },
    { bg: '#e8d5f5', border: '#9b59b6' },
    { bg: '#d5f5f0', border: '#1abc9c' }
];

export default class PhoneCalendar extends NavigationMixin(LightningElement) { // eslint-disable-line
    // ── Core state ──────────────────────────────────────────────────────────────
    @track anchorDateStr = '';
    @track viewMode = 'month';
    @track calendarWeeks = [];
    @track events = [];
    @track isLoading = false;

    // ── User / Calendar selection ────────────────────────────────────────────────
    @track availableUsers = [];
    @track availableCalendars = [];
    @track selectedUserIds = [];
    @track showUserPanel = false;
    @track userPanelExpanded = false;
    @track userSearchTerm = '';

    // ── Month view: day panel ────────────────────────────────────────────────────
    @track showDayPanel = false;
    @track dayPanelExpanded = false;
    @track selectedDate = null;
    @track selectedDayEvents = [];

    // ── View mode popup ──────────────────────────────────────────────────────────
    @track showViewModeMenu = false;

    // ── Public API ───────────────────────────────────────────────────────────────
    @api workStartHour = 9;
    @api workEndHour   = 18;

    // ── i18n ─────────────────────────────────────────────────────────────────────
    locale = LOCALE;
    label = {
        agendaSuffix:        labelAgendaSuffix,
        allDay:              labelAllDay,
        close:               labelClose,
        create:              labelCreate,
        dateRangeSep:        labelDateRangeSep,
        displayUsers:        labelDisplayUsers,
        error:               labelError,
        errorLoad:           labelErrorLoad,
        hours:               labelHours,
        loading:             labelLoading,
        maxUsersReached:     labelMaxUsersReached,
        minutes:             labelMinutes,
        newEventAlt:         labelNewEventAlt,
        newEventAriaLabel:   labelNewEventAriaLabel,
        nextPeriod:          labelNextPeriod,
        noEventsInPeriod:    labelNoEventsInPeriod,
        noEventsOnDay:       labelNoEventsOnDay,
        openDayView:         labelOpenDayView,
        prevPeriod:          labelPrevPeriod,
        searchPlaceholder:   labelSearchPlaceholder,
        sectionPublicResource: labelSectionPublicResource,
        sectionUsers:        labelSectionUsers,
        selectedSuffix:      labelSelectedSuffix,
        today:               labelToday,
        typePublic:          labelTypePublic,
        typeResource:        labelTypeResource,
        userSelectAriaLabel: labelUserSelectAriaLabel,
        view3Day:            labelView3Day,
        view3DayBadge:       labelView3DayBadge,
        viewAgenda:          labelViewAgenda,
        viewDay:             labelViewDay,
        viewModeAriaLabel:   labelViewModeAriaLabel,
        viewModeTitle:       labelViewModeTitle,
        viewMonth:           labelViewMonth
    };

    // ── Non-reactive internal state ──────────────────────────────────────────────
    currentUserId = loggedInUserId;
    focusSelectorAfterRender = null;
    touchStartX = 0;
    touchStartY = 0;
    sheetStartY = 0;
    shouldScrollToCurrentHour = false;
    touchMoveHandler = null;
    touchMoveListenerAdded = false;
    _initialLoadDone = false;

    // ── Wire: user list ──────────────────────────────────────────────────────────

    @wire(getActiveUsers)
    wiredUsers({ data }) {
        if (data) {
            this.availableUsers = data;
        }
    }

    @wire(getPublicCalendars)
    wiredCalendars({ data }) {
        if (data) {
            this.availableCalendars = data;
        }
    }

    // ── Wire: reload on navigation return ────────────────────────────────────────

    @wire(CurrentPageReference)
    wiredPageRef() {
        if (this._initialLoadDone) {
            this.loadEvents();
        }
    }

    // ── Derived date parts ──────────────────────────────────────────────────────

    get anchorYear()      { return parseInt(this.anchorDateStr.split('-')[0], RADIX_DECIMAL); }
    get anchorMonth()     { return parseInt(this.anchorDateStr.split('-')[1], RADIX_DECIMAL) - 1; }
    get anchorDayNumber() { return parseInt(this.anchorDateStr.split('-')[2], RADIX_DECIMAL); }

    // ── View mode flags ─────────────────────────────────────────────────────────

    get isMonthView() { return this.viewMode === 'month'; }
    get isDayView()   { return this.viewMode === 'day'; }
    get is3DayView()  { return this.viewMode === '3day'; }
    get isAgendaView(){ return this.viewMode === 'agenda'; }

    get dayOfWeekLabels() {
        // Reference Sunday: 2024-01-07
        const sun = new Date(2024, 0, 7);
        const fmt = new Intl.DateTimeFormat(this.locale, { weekday: 'narrow' });
        return Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
            const d = new Date(sun);
            d.setDate(sun.getDate() + i);
            return { id: String(i), label: fmt.format(d) };
        });
    }

    get viewModeLabel() {
        const map = {
            month:  this.label.viewMonth,
            day:    this.label.viewDay,
            '3day': this.label.view3DayBadge,
            agenda: this.label.viewAgenda
        };
        return map[this.viewMode] || '';
    }

    // ── Popup option classes ────────────────────────────────────────────────────

    get popupDayClass()    { return `action-opt${this.isDayView    ? ' action-opt_active' : ''}`; }
    get popup3DayClass()   { return `action-opt${this.is3DayView   ? ' action-opt_active' : ''}`; }
    get popupMonthClass()  { return `action-opt${this.isMonthView   ? ' action-opt_active' : ''}`; }
    get popupAgendaClass() { return `action-opt${this.isAgendaView  ? ' action-opt_active' : ''}`; }

    // ── Period label ────────────────────────────────────────────────────────────

    get periodLabel() {
        if (!this.anchorDateStr) { return ''; }
        const anchor = new Date(this.anchorDateStr + 'T00:00:00');

        if (this.viewMode === 'month') {
            return new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'long' }).format(anchor);
        }
        if (this.viewMode === 'day') {
            return new Intl.DateTimeFormat(this.locale, { month: 'long', day: 'numeric', weekday: 'short' }).format(anchor);
        }
        if (this.viewMode === '3day') {
            const end = new Date(anchor);
            end.setDate(end.getDate() + THREE_DAY_OFFSET);
            const fmt = new Intl.DateTimeFormat(this.locale, { month: 'numeric', day: 'numeric' });
            return `${fmt.format(anchor)}${this.label.dateRangeSep}${fmt.format(end)}`;
        }
        if (this.viewMode === 'agenda') {
            return new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(anchor) + this.label.agendaSuffix;
        }
        return '';
    }

    // ── Time grid shared ────────────────────────────────────────────────────────

    get timeGridContainerStyle() {
        return `height: ${TIME_GRID_TOTAL_PX}px; position: relative;`;
    }

    get eventsColStyle() {
        const startPx  = this.workStartHour * HOUR_HEIGHT_PX;
        const endPx    = this.workEndHour   * HOUR_HEIGHT_PX;
        const offColor = 'rgba(0,0,0,0.06)';
        const offGrad  = `linear-gradient(to bottom, ${offColor} ${startPx}px, transparent ${startPx}px, transparent ${endPx}px, ${offColor} ${endPx}px)`;
        const hrGrad   = `repeating-linear-gradient(to bottom, transparent 0px, transparent 59px, var(--slds-g-color-border-base-1, #e5e5e5) 59px, var(--slds-g-color-border-base-1, #e5e5e5) 60px)`;
        return `height: ${TIME_GRID_TOTAL_PX}px; position: relative; background-image: ${offGrad}, ${hrGrad}; background-size: 100% 100%, 100% 60px;`;
    }

    get hourLineItems() {
        return Array.from({ length: HOURS_IN_DAY }, (_, h) => ({
            id:       `hl-${h}`,
            label:    `${String(h).padStart(PAD_LENGTH, PAD_CHAR)}:00`,
            topStyle: `top: ${h * HOUR_HEIGHT_PX}px;`
        }));
    }

    get currentTimeLineStyle() {
        const now = new Date();
        return `top: ${(now.getHours() * 60 + now.getMinutes()) * PX_PER_MINUTE}px;`;
    }

    get showCurrentTimeInDay() {
        return this.isDayView && this.anchorDateStr === this.toDateStr(new Date());
    }

    get showCurrentTimeInCol0() {
        return this.is3DayView && this.threeDayDates[0] === this.toDateStr(new Date());
    }

    get showCurrentTimeInCol1() {
        return this.is3DayView && this.threeDayDates[1] === this.toDateStr(new Date());
    }

    get showCurrentTimeInCol2() {
        return this.is3DayView && this.threeDayDates[2] === this.toDateStr(new Date());
    }

    // ── Day view ────────────────────────────────────────────────────────────────

    get dayViewAllDayEvents() {
        return this.events.filter(e => e.IsAllDayEvent && e.ActivityDate === this.anchorDateStr);
    }

    get hasDayViewAllDayEvents() {
        return this.dayViewAllDayEvents.length > 0;
    }

    get dayViewEvents() {
        const filtered = this.events.filter(e => !e.IsAllDayEvent && e.ActivityDateTime && this.eventOverlapsDate(e, this.anchorDateStr));
        return this.layoutEvents(filtered, this.anchorDateStr);
    }

    // ── 3-Day view ──────────────────────────────────────────────────────────────

    get threeDayDates() {
        const anchor = new Date(this.anchorDateStr + 'T00:00:00');
        return Array.from({ length: THREE_DAY_STEP }, (_, i) => {
            const d = new Date(anchor);
            d.setDate(d.getDate() + i);
            return this.toDateStr(d);
        });
    }

    get threeDayDateHeaders() {
        const todayStr = this.toDateStr(new Date());
        return this.threeDayDates.map((dateStr, idx) => {
            const d       = new Date(dateStr + 'T00:00:00');
            const isToday = dateStr === todayStr;
            return {
                id:          `tdh-${idx}`,
                dow:         new Intl.DateTimeFormat(this.locale, { weekday: 'narrow' }).format(d),
                day:         String(d.getDate()),
                headerClass: `date-col-header${isToday ? ' date-col-header_today' : ''}`,
                dayClass:    `date-col-day${isToday ? ' date-col-day_today' : ''}`
            };
        });
    }

    get threeDayEventsCol0() { return this.getEventsForDate(this.threeDayDates[0]); }
    get threeDayEventsCol1() { return this.getEventsForDate(this.threeDayDates[1]); }
    get threeDayEventsCol2() { return this.getEventsForDate(this.threeDayDates[2]); }

    getEventsForDate(dateStr) {
        if (!dateStr) { return []; }
        const filtered = this.events.filter(e => !e.IsAllDayEvent && e.ActivityDateTime && this.eventOverlapsDate(e, dateStr));
        return this.layoutEvents(filtered, dateStr);
    }

    // ── Event overlap check (supports multi-day timed events) ───────────────────

    eventOverlapsDate(event, dateStr) {
        if (event.IsAllDayEvent || !event.ActivityDateTime) {
            return event.ActivityDate === dateStr;
        }
        const startDateStr = event.ActivityDate;
        if (!event.EndDateTime) { return startDateStr === dateStr; }
        // Subtract 1 ms so events ending exactly at 00:00 belong to the previous day
        const endDateStr = this.toDateStr(new Date(new Date(event.EndDateTime).getTime() - 1));
        return startDateStr <= dateStr && endDateStr >= dateStr;
    }

    // ── Event layout (overlap → side-by-side columns) ───────────────────────────

    layoutEvents(rawEvents, dateStr) {
        if (!rawEvents || rawEvents.length === 0) { return []; }

        const items = rawEvents.map(e => {
            const startDt    = new Date(e.ActivityDateTime);
            const isStartDay = e.ActivityDate === dateStr;
            const startMin   = isStartDay ? startDt.getHours() * 60 + startDt.getMinutes() : 0;

            const rawEndDt      = e.EndDateTime
                ? new Date(e.EndDateTime)
                : new Date(startDt.getTime() + DEFAULT_DURATION_MINUTES * MS_PER_MINUTE);
            const endDateStr    = this.toDateStr(new Date(rawEndDt.getTime() - 1));
            const isEndDay      = endDateStr === dateStr;
            const rawEndMinutes = rawEndDt.getHours() * 60 + rawEndDt.getMinutes();
            // midnight (0 min) on end day → treat as 1440 (bottom of grid)
            const endMin        = isEndDay
                ? (rawEndMinutes === 0 ? HOURS_IN_DAY * 60 : rawEndMinutes)
                : HOURS_IN_DAY * 60;

            const clippedDuration = Math.max(endMin - startMin, 15);
            const totalDurationMin = Math.max(
                Math.round((rawEndDt.getTime() - startDt.getTime()) / MS_PER_MINUTE),
                DEFAULT_DURATION_MINUTES
            );
            return { e, startMin, endMin: startMin + clippedDuration, totalDurationMin };
        });

        items.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

        const colEnds = [];
        const colIdx  = new Array(items.length);
        items.forEach((item, i) => {
            const col = colEnds.findIndex(t => t <= item.startMin);
            if (col === -1) {
                colIdx[i] = colEnds.length;
                colEnds.push(item.endMin);
            } else {
                colIdx[i] = col;
                colEnds[col] = item.endMin;
            }
        });

        const colCounts = items.map((item, i) => {
            let maxCol = colIdx[i];
            items.forEach((other, j) => {
                if (i !== j && other.startMin < item.endMin && other.endMin > item.startMin) {
                    if (colIdx[j] > maxCol) { maxCol = colIdx[j]; }
                }
            });
            return maxCol + 1;
        });

        return items.map((item, i) => {
            const col         = colIdx[i];
            const colCount    = colCounts[i];
            const widthPct    = 100 / colCount;
            const leftPct     = col * widthPct;
            const durationMin  = item.endMin - item.startMin;
            const height       = Math.max(durationMin * PX_PER_MINUTE, MIN_EVENT_HEIGHT_PX);
            const colorIdx     = this.selectedUserIds.indexOf(item.e.OwnerId);
            const color        = USER_COLORS[Math.max(colorIdx, 0) % USER_COLORS.length];
            // Show total event duration (not clipped), in minutes
            const labelMin     = item.totalDurationMin;

            let durationLabel;
            if (labelMin < 60) {
                durationLabel = `${labelMin}${this.label.minutes}`;
            } else if (labelMin % 60 === 0) {
                durationLabel = `${labelMin / 60}${this.label.hours}`;
            } else {
                durationLabel = `${Math.floor(labelMin / 60)}${this.label.hours}${labelMin % 60}${this.label.minutes}`;
            }

            const positionStyle = `top: ${item.startMin * PX_PER_MINUTE}px; height: ${height}px; left: calc(${leftPct}% + 2px); width: calc(${widthPct}% - 4px); background-color: ${color.bg}; border-left-color: ${color.border};`;

            return {
                ...item.e,
                timeLabel:     this.formatTimeLabel(item.e.ActivityDateTime, item.e.EndDateTime, false),
                durationLabel,
                showMeta:      height >= SHOW_META_MIN_HEIGHT,
                positionStyle,
                eventClass:    'te-event'
            };
        });
    }

    // ── Agenda view ─────────────────────────────────────────────────────────────

    get agendaGroups() {
        const todayStr = this.toDateStr(new Date());
        const anchor   = new Date(this.anchorDateStr + 'T00:00:00');
        const groups   = [];

        for (let i = 0; i < MAX_AGENDA_DAYS; i++) {
            const d       = new Date(anchor);
            d.setDate(d.getDate() + i);
            const dateStr   = this.toDateStr(d);
            const dayEvents = this.events.filter(e => this.eventOverlapsDate(e, dateStr));

            if (dayEvents.length > 0) {
                const isToday = dateStr === todayStr;
                groups.push({
                    id:          `ag-${dateStr}`,
                    label:       this.formatAgendaDateLabel(d, isToday),
                    headerClass: `agenda-date-header${isToday ? ' agenda-date-header_today' : ''}`,
                    events:      dayEvents.map(e => {
                        const colorIdx = this.selectedUserIds.indexOf(e.OwnerId);
                        const color    = USER_COLORS[Math.max(colorIdx, 0) % USER_COLORS.length];
                        return { ...e, colorBarStyle: `background-color: ${color.border};` };
                    })
                });
            }
        }
        return groups;
    }

    get hasAgendaGroups() { return this.agendaGroups.length > 0; }

    // ── User selection ──────────────────────────────────────────────────────────

    get atMaxUsers() { return this.selectedUserIds.length >= MAX_SELECTED_USERS; }

    get userSelectionLabel() {
        return `${this.selectedUserIds.length} / ${MAX_SELECTED_USERS} ${this.label.selectedSuffix}`;
    }

    get hasAvailableCalendars() { return this.availableCalendars.length > 0; }

    get filteredCalendarsWithState() {
        const term  = (this.userSearchTerm || '').trim().toLowerCase();
        const atMax = this.atMaxUsers;
        return this.availableCalendars
            .filter(c => !term || c.Name.toLowerCase().includes(term))
            .map((c, idx) => {
                const isSelected  = this.selectedUserIds.includes(c.Id);
                const isDisabled  = atMax && !isSelected;
                const selectedIdx = this.selectedUserIds.indexOf(c.Id);
                const colorIdx    = selectedIdx >= 0 ? selectedIdx : this.availableUsers.length + idx;
                return {
                    ...c,
                    isSelected,
                    isDisabled,
                    typeLabel:     c.Type === 'R' ? this.label.typeResource : this.label.typePublic,
                    colorDotStyle: `background-color: ${USER_COLORS[colorIdx % USER_COLORS.length].border};`,
                    rowClass:      `user-row${isSelected ? ' user-row_selected' : ''}${isDisabled ? ' user-row_disabled' : ''}`
                };
            });
    }

    get availableUsersWithState() {
        const atMax = this.atMaxUsers;
        return this.availableUsers.map((u, idx) => {
            const isSelected  = this.selectedUserIds.includes(u.Id);
            const isDisabled  = atMax && !isSelected;
            const selectedIdx = this.selectedUserIds.indexOf(u.Id);
            // Use the same index as event coloring (selectedUserIds position) for selected users
            const colorIdx    = selectedIdx >= 0 ? selectedIdx : idx;
            return {
                ...u,
                isSelected,
                isDisabled,
                colorDotStyle: `background-color: ${USER_COLORS[colorIdx % USER_COLORS.length].border};`,
                rowClass:      `user-row${isSelected ? ' user-row_selected' : ''}${isDisabled ? ' user-row_disabled' : ''}`
            };
        });
    }

    get filteredUsersWithState() {
        const term = (this.userSearchTerm || '').trim().toLowerCase();
        if (!term) { return this.availableUsersWithState; }
        return this.availableUsersWithState.filter(u => u.Name.toLowerCase().includes(term));
    }

    // ── Day panel ───────────────────────────────────────────────────────────────

    get dayPanelSheetClass() {
        return `bottom-sheet${this.dayPanelExpanded ? ' bottom-sheet_expanded' : ''}`;
    }

    get userPanelSheetClass() {
        return `bottom-sheet${this.userPanelExpanded ? ' bottom-sheet_expanded' : ''}`;
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    connectedCallback() {
        this.anchorDateStr    = this.toDateStr(new Date());
        this.touchMoveHandler = (evt) => {
            if (evt.touches.length !== 1) { return; }
            const dx = Math.abs(evt.touches[0].clientX - this.touchStartX);
            const dy = Math.abs(evt.touches[0].clientY - this.touchStartY);
            if (dx > 10 && dx > dy) {
                evt.preventDefault();
            }
        };

        getCalendarPreference()
            .then(result => {
                if (result) {
                    const ids = result.split(',').filter(Boolean);
                    this.selectedUserIds = ids.length > 0 ? ids : [loggedInUserId];
                } else {
                    this.selectedUserIds = [loggedInUserId];
                }
            })
            .catch(() => {
                this.selectedUserIds = [loggedInUserId];
            })
            .finally(() => {
                this._initialLoadDone = true;
                this.loadEvents();
            });
    }

    disconnectedCallback() {
        if (this.touchMoveListenerAdded && this.touchMoveHandler) {
            const el = this.template.querySelector('.calendar-root');
            if (el) {
                el.removeEventListener('touchmove', this.touchMoveHandler);
            }
        }
    }

    renderedCallback() {
        if (!this.touchMoveListenerAdded) {
            const el = this.template.querySelector('.calendar-root');
            if (el) {
                el.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
                this.touchMoveListenerAdded = true;
            }
        }
        if (this.focusSelectorAfterRender) {
            const el = this.template.querySelector(this.focusSelectorAfterRender);
            if (el) { el.focus(); }
            this.focusSelectorAfterRender = null;
        }
        if (this.shouldScrollToCurrentHour) {
            this.scrollToCurrentHour();
            this.shouldScrollToCurrentHour = false;
        }
    }

    // ── Data loading ────────────────────────────────────────────────────────────

    loadEvents() {
        this.isLoading = true;
        const range = this.getDateRangeForView();

        getEventsForMonth({ startDate: range.start, endDate: range.end, ownerIds: this.selectedUserIds })
            .then(result => {
                this.events = result.map(e => ({
                    ...e,
                    timeLabel: this.formatTimeLabel(e.ActivityDateTime, e.EndDateTime, e.IsAllDayEvent)
                }));
                if (this.isMonthView) {
                    this.buildCalendar();
                }
            })
            .catch(error => {
                this.showToast(this.label.error, error.body?.message || this.label.errorLoad, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    getDateRangeForView() {
        const anchor = new Date(this.anchorDateStr + 'T00:00:00');
        const y = anchor.getFullYear();
        const m = anchor.getMonth();

        if (this.viewMode === 'month') {
            return { start: this.toDateStr(new Date(y, m, 1)), end: this.toDateStr(new Date(y, m + 1, 0)) };
        }
        if (this.viewMode === 'day') {
            return { start: this.anchorDateStr, end: this.anchorDateStr };
        }
        if (this.viewMode === '3day') {
            const end = new Date(anchor);
            end.setDate(end.getDate() + THREE_DAY_OFFSET);
            return { start: this.anchorDateStr, end: this.toDateStr(end) };
        }
        if (this.viewMode === 'agenda') {
            const end = new Date(anchor);
            end.setDate(end.getDate() + MAX_AGENDA_DAYS - 1);
            return { start: this.anchorDateStr, end: this.toDateStr(end) };
        }
        return { start: this.anchorDateStr, end: this.anchorDateStr };
    }

    // ── Calendar grid (month view) ──────────────────────────────────────────────

    buildCalendar() {
        const year  = this.anchorYear;
        const month = this.anchorMonth;
        const todayStr    = this.toDateStr(new Date());
        const firstDow    = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDow; i++) {
            days.push({ id: `pad-${i}`, dayNumber: '', cellClass: 'slds-col day-cell day-cell_empty', labelClass: 'day-number', dateStr: '', eventDots: [] });
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(PAD_LENGTH, PAD_CHAR)}-${String(d).padStart(PAD_LENGTH, PAD_CHAR)}`;
            const dow     = new Date(year, month, d).getDay();
            const isToday = dateStr === todayStr;
            const isSun   = dow === DOW_SUNDAY;
            const isSat   = dow === DOW_SATURDAY;

            const dayEvts  = this.events.filter(e => this.eventOverlapsDate(e, dateStr));
            const ownerIds = [...new Set(dayEvts.map(e => e.OwnerId))];
            const eventDots = ownerIds.slice(0, MAX_EVENT_DOTS).map((oid, idx) => {
                const colorIdx = this.selectedUserIds.indexOf(oid);
                const color    = USER_COLORS[Math.max(colorIdx, 0) % USER_COLORS.length];
                return { id: `dot-${dateStr}-${idx}`, dotStyle: `background-color: ${color.border};` };
            });

            let cellClass = 'slds-col day-cell';
            if (isToday) { cellClass += ' day-cell_today'; }
            if (isSun)   { cellClass += ' day-cell_sun'; }
            if (isSat)   { cellClass += ' day-cell_sat'; }

            days.push({
                id: `day-${dateStr}`, dayNumber: d,
                cellClass,
                labelClass: isToday ? 'day-number day-number_today' : 'day-number',
                dateStr, eventDots
            });
        }

        const remainder = days.length % DAYS_PER_WEEK;
        if (remainder !== 0) {
            for (let i = 0; i < DAYS_PER_WEEK - remainder; i++) {
                days.push({ id: `tail-${i}`, dayNumber: '', cellClass: 'slds-col day-cell day-cell_empty', labelClass: 'day-number', dateStr: '', eventDots: [] });
            }
        }

        const weeks = [];
        for (let i = 0; i < days.length; i += DAYS_PER_WEEK) {
            weeks.push({ id: `week-${i}`, days: days.slice(i, i + DAYS_PER_WEEK) });
        }
        this.calendarWeeks = weeks;
    }

    // ── Navigation ──────────────────────────────────────────────────────────────

    handlePrevPeriod() {
        this.anchorDateStr = this.shiftDate(-1);
        this.loadEvents();
    }

    handleNextPeriod() {
        this.anchorDateStr = this.shiftDate(1);
        this.loadEvents();
    }

    shiftDate(direction) {
        const d = new Date(this.anchorDateStr + 'T00:00:00');
        if (this.viewMode === 'month') {
            d.setMonth(d.getMonth() + direction);
            d.setDate(1);
        } else if (this.viewMode === 'day') {
            d.setDate(d.getDate() + direction);
        } else if (this.viewMode === '3day') {
            d.setDate(d.getDate() + THREE_DAY_STEP * direction);
        } else if (this.viewMode === 'agenda') {
            d.setDate(d.getDate() + AGENDA_NAV_DAYS * direction);
        }
        return this.toDateStr(d);
    }

    handleTodayClick() {
        const todayStr = this.toDateStr(new Date());
        if (this.anchorDateStr === todayStr && this.viewMode !== 'month') { return; }
        this.anchorDateStr = todayStr;
        if (this.viewMode === 'day' || this.viewMode === '3day') {
            this.shouldScrollToCurrentHour = true;
        }
        this.loadEvents();
    }

    // ── Swipe (calendar area) ────────────────────────────────────────────────────

    handleTouchStart(event) {
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
    }

    handleTouchEnd(event) {
        const dx = event.changedTouches[0].clientX - this.touchStartX;
        const dy = event.changedTouches[0].clientY - this.touchStartY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx < 0) {
                this.handleNextPeriod();
            } else {
                this.handlePrevPeriod();
            }
        }
    }

    scrollToCurrentHour() {
        const scroll = this.template.querySelector('.time-grid-scroll');
        if (!scroll) { return; }
        const now = new Date();
        const topPx = (now.getHours() * 60 + now.getMinutes()) * PX_PER_MINUTE;
        scroll.scrollTop = Math.max(0, topPx - scroll.clientHeight / 3);
    }

    // ── Bottom sheet swipe ───────────────────────────────────────────────────────

    handleSheetTouchStart(event) {
        if (event.touches.length !== 1) { return; }
        this.sheetStartY = event.touches[0].clientY;
    }

    handleSheetTouchEnd(event) {
        if (event.changedTouches.length !== 1) { return; }
        const deltaY = event.changedTouches[0].clientY - this.sheetStartY;
        if (deltaY > SHEET_SWIPE_THRESHOLD) {
            this.showDayPanel      = false;
            this.dayPanelExpanded  = false;
        } else if (deltaY < -SHEET_SWIPE_THRESHOLD) {
            this.dayPanelExpanded  = true;
        }
    }

    // ── View mode popup ──────────────────────────────────────────────────────────

    handleViewModeMenuOpen() {
        this.showViewModeMenu = true;
    }

    handleViewModeMenuClose() {
        this.showViewModeMenu = false;
    }

    handleViewModeSelect(event) {
        const mode = event.currentTarget.dataset.mode;
        this.showViewModeMenu = false;
        if (mode === this.viewMode) { return; }
        this.viewMode = mode;
        if (mode === 'day' || mode === '3day') {
            this.shouldScrollToCurrentHour = true;
        }
        this.loadEvents();
    }

    // ── User panel ───────────────────────────────────────────────────────────────

    handleOpenUserPanel() {
        this.userSearchTerm    = '';
        this.userPanelExpanded = false;
        this.showUserPanel     = true;
    }

    handleCloseUserPanel() {
        this.showUserPanel     = false;
        this.userPanelExpanded = false;
    }

    handleUserSheetTouchEnd(event) {
        if (event.changedTouches.length !== 1) { return; }
        const deltaY = event.changedTouches[0].clientY - this.sheetStartY;
        if (deltaY > SHEET_SWIPE_THRESHOLD) {
            this.showUserPanel     = false;
            this.userPanelExpanded = false;
        } else if (deltaY < -SHEET_SWIPE_THRESHOLD) {
            this.userPanelExpanded = true;
        }
    }

    handleUserSearch(event) {
        this.userSearchTerm = event.detail.value;
    }

    handleUserToggle(event) {
        const uid = event.currentTarget.dataset.id;
        const idx = this.selectedUserIds.indexOf(uid);
        if (idx >= 0) {
            if (this.selectedUserIds.length === 1) { return; }
            this.selectedUserIds = this.selectedUserIds.filter(id => id !== uid);
        } else {
            if (this.selectedUserIds.length >= MAX_SELECTED_USERS) { return; }
            this.selectedUserIds = [...this.selectedUserIds, uid];
        }
        this.savePreference();
        this.loadEvents();
    }

    savePreference() {
        saveCalendarPreference({ selectedUserIds: this.selectedUserIds.join(',') })
            .catch(() => {});
    }

    // ── Month view: day click ────────────────────────────────────────────────────

    handleDayClick(event) {
        const dateStr = event.currentTarget.dataset.date;
        if (!dateStr) { return; }
        this.selectedDate     = dateStr;
        this.dayPanelExpanded = false;
        this.selectedDayEvents = this.events
            .filter(e => this.eventOverlapsDate(e, dateStr))
            .map(e => {
                const colorIdx = this.selectedUserIds.indexOf(e.OwnerId);
                const color    = USER_COLORS[Math.max(colorIdx, 0) % USER_COLORS.length];
                return { ...e, colorBarStyle: `background-color: ${color.border};` };
            });
        this.showDayPanel = true;
        this.focusSelectorAfterRender = '.bottom-sheet lightning-button-icon';
    }

    handleOverlayClick() {
        this.showDayPanel     = false;
        this.dayPanelExpanded = false;
    }

    handleCloseDayPanel() {
        this.showDayPanel     = false;
        this.dayPanelExpanded = false;
    }

    handleViewDayForSelectedDate() {
        this.anchorDateStr             = this.selectedDate;
        this.viewMode                  = 'day';
        this.showDayPanel              = false;
        this.dayPanelExpanded          = false;
        this.shouldScrollToCurrentHour = true;
        this.loadEvents();
    }

    // ── Event navigation ─────────────────────────────────────────────────────────

    handleEventClick(event) {
        const recordId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, objectApiName: 'Event', actionName: 'view' }
        });
    }

    // ── Create event (standard Salesforce screen) ────────────────────────────────

    handleNewEvent() {
        const anchor  = this.anchorDateStr || this.toDateStr(new Date());
        const startDt = new Date(`${anchor}T09:00:00`);
        const endDt   = new Date(`${anchor}T10:00:00`);
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Event', actionName: 'new' },
            state: {
                defaultFieldValues: encodeDefaultFieldValues({
                    ActivityDateTime: startDt.toISOString(),
                    EndDateTime:      endDt.toISOString()
                })
            }
        });
    }

    handleNewEventForSelectedDate() {
        const anchor  = this.selectedDate || this.anchorDateStr;
        const startDt = new Date(`${anchor}T09:00:00`);
        const endDt   = new Date(`${anchor}T10:00:00`);
        this.showDayPanel     = false;
        this.dayPanelExpanded = false;
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Event', actionName: 'new' },
            state: {
                defaultFieldValues: encodeDefaultFieldValues({
                    ActivityDateTime: startDt.toISOString(),
                    EndDateTime:      endDt.toISOString()
                })
            }
        });
    }

    // ── Computed helpers ─────────────────────────────────────────────────────────

    get selectedDateLabel() {
        if (!this.selectedDate) { return ''; }
        const d = new Date(this.selectedDate + 'T00:00:00');
        return new Intl.DateTimeFormat(this.locale, { month: 'long', day: 'numeric' }).format(d);
    }

    get hasSelectedDayEvents() { return this.selectedDayEvents.length > 0; }

    toDateStr(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(PAD_LENGTH, PAD_CHAR)}-${String(date.getDate()).padStart(PAD_LENGTH, PAD_CHAR)}`;
    }

    formatTimeLabel(startDT, endDT, isAllDay) {
        if (isAllDay || !startDT) { return this.label.allDay; }
        const pad = n => String(n).padStart(PAD_LENGTH, PAD_CHAR);
        const s = new Date(startDT);
        const sLabel = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
        if (!endDT) { return sLabel; }
        const e = new Date(endDT);
        return `${sLabel} ～ ${pad(e.getHours())}:${pad(e.getMinutes())}`;
    }

    formatAgendaDateLabel(date, isToday) {
        const formatted = new Intl.DateTimeFormat(this.locale, { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
        if (isToday) { return `${this.label.today} ${formatted}`; }
        return formatted;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
