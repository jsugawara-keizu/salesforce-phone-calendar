/**
 * @description Unit tests for PhoneCalendarController.
 *
 * Coverage targets:
 *  - getActiveUsers       : returns active Standard users, running user first
 *  - getEventsForMonth    : date-range filtering, owner filtering, multi-day events, validation errors
 *  - getPublicCalendars   : smoke test (Calendar DML not available in tests)
 *  - getCalendarPreference: returns null when absent, returns saved value
 *  - saveCalendarPreference: insert on first call, update on subsequent call
 *  - createEvent          : field mapping, default end time, negative-duration fallback, validation errors
 */
@isTest
private class PhoneCalendarControllerTest {
  // ─── ヘルパー ──────────────────────────────────────────────────────────────

  /** テスト用 Standard User を生成（未 insert）*/
  private static User buildUser(String lastName) {
    Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
    return new User(
      LastName = lastName,
      FirstName = 'Test',
      Email = lastName.toLowerCase() + '@phonecal.test',
      Username = lastName.toLowerCase() +
        '@phonecal.test.' +
        System.currentTimeMillis(),
      Alias = lastName.left(8),
      TimeZoneSidKey = 'America/Los_Angeles',
      LocaleSidKey = 'en_US',
      EmailEncodingKey = 'UTF-8',
      LanguageLocaleKey = 'en_US',
      ProfileId = p.Id
    );
  }

  /** 今日を含む 7 日間の日付文字列ペアを返す */
  private static String[] weekRange() {
    return new List<String>{
      String.valueOf(Date.today()),
      String.valueOf(Date.today().addDays(6))
    };
  }

  // ─── getActiveUsers ────────────────────────────────────────────────────────

  @isTest
  static void getActiveUsers_returnsActiveStandardUsers() {
    User u1 = buildUser('Aoyama');
    User u2 = buildUser('Hayashi');
    insert new List<User>{ u1, u2 };

    Test.startTest();
    List<User> result = PhoneCalendarController.getActiveUsers();
    Test.stopTest();

    Set<Id> ids = new Map<Id, User>(result).keySet();
    System.assert(ids.contains(u1.Id), 'u1 should appear in results');
    System.assert(ids.contains(u2.Id), 'u2 should appear in results');
  }

  @isTest
  static void getActiveUsers_runningUserIsFirst() {
    // 名前が末尾に来るユーザーを作り、自分が先頭にソートされることを検証
    User last = buildUser('ZZZLastUser');
    insert last;

    List<User> result;
    System.runAs(last) {
      Test.startTest();
      result = PhoneCalendarController.getActiveUsers();
      Test.stopTest();
    }

    System.assertNotEquals(0, result.size(), 'Result should not be empty');
    System.assertEquals(last.Id, result[0].Id, 'Running user should be first');
  }

  // ─── getEventsForMonth ─────────────────────────────────────────────────────

  @isTest
  static void getEventsForMonth_blankStartDateThrows() {
    Boolean threw = false;
    Test.startTest();
    try {
      PhoneCalendarController.getEventsForMonth('', '2025-01-31', null);
    } catch (AuraHandledException e) {
      threw = true;
    }
    Test.stopTest();
    System.assert(
      threw,
      'Should throw AuraHandledException for blank startDate'
    );
  }

  @isTest
  static void getEventsForMonth_blankEndDateThrows() {
    Boolean threw = false;
    Test.startTest();
    try {
      PhoneCalendarController.getEventsForMonth('2025-01-01', '', null);
    } catch (AuraHandledException e) {
      threw = true;
    }
    Test.stopTest();
    System.assert(threw, 'Should throw AuraHandledException for blank endDate');
  }

  @isTest
  static void getEventsForMonth_nullOwnerIdsDefaultsToCurrentUser() {
    Event ev = new Event(
      Subject = 'My Solo Event',
      ActivityDateTime = Datetime.newInstance(
        Date.today().addDays(1),
        Time.newInstance(10, 0, 0, 0)
      ),
      DurationInMinutes = 60
    );
    insert ev;

    String[] range = weekRange();
    Test.startTest();
    List<Event> result = PhoneCalendarController.getEventsForMonth(
      range[0],
      range[1],
      null
    );
    Test.stopTest();

    Set<Id> ids = new Set<Id>();
    for (Event e : result) {
      ids.add(e.Id);
    }
    System.assert(
      ids.contains(ev.Id),
      'Event should be returned when ownerIds is null'
    );
  }

  @isTest
  static void getEventsForMonth_returnsEventsInRange() {
    Date start = Date.today();
    Date end = start.addDays(6);

    Event inRange = new Event(
      Subject = 'In Range',
      ActivityDateTime = Datetime.newInstance(
        start.addDays(2),
        Time.newInstance(9, 0, 0, 0)
      ),
      DurationInMinutes = 60
    );
    Event outOfRange = new Event(
      Subject = 'Out of Range',
      ActivityDateTime = Datetime.newInstance(
        end.addDays(2),
        Time.newInstance(9, 0, 0, 0)
      ),
      DurationInMinutes = 60
    );
    insert new List<Event>{ inRange, outOfRange };

    Test.startTest();
    List<Event> result = PhoneCalendarController.getEventsForMonth(
      String.valueOf(start),
      String.valueOf(end),
      new List<Id>{ UserInfo.getUserId() }
    );
    Test.stopTest();

    Set<Id> ids = new Set<Id>();
    for (Event e : result) {
      ids.add(e.Id);
    }
    System.assert(
      ids.contains(inRange.Id),
      'In-range event should be returned'
    );
    System.assert(
      !ids.contains(outOfRange.Id),
      'Out-of-range event should NOT be returned'
    );
  }

  @isTest
  static void getEventsForMonth_includesMultiDayEventSpanningRangeStart() {
    // 範囲開始前に始まり、範囲内に EndDateTime がある日跨ぎイベント
    Date rangeStart = Date.today().addDays(10);
    Date rangeEnd = rangeStart.addDays(6);

    Datetime evStart = Datetime.newInstance(
      rangeStart.addDays(-1),
      Time.newInstance(22, 0, 0, 0)
    );
    Datetime evEnd = Datetime.newInstance(
      rangeStart,
      Time.newInstance(4, 0, 0, 0)
    );

    Event multiDay = new Event(
      Subject = 'Overnight Conference',
      ActivityDateTime = evStart,
      EndDateTime = evEnd,
      DurationInMinutes = 360,
      IsAllDayEvent = false
    );
    insert multiDay;

    Test.startTest();
    List<Event> result = PhoneCalendarController.getEventsForMonth(
      String.valueOf(rangeStart),
      String.valueOf(rangeEnd),
      new List<Id>{ UserInfo.getUserId() }
    );
    Test.stopTest();

    Set<Id> ids = new Set<Id>();
    for (Event e : result) {
      ids.add(e.Id);
    }
    System.assert(
      ids.contains(multiDay.Id),
      'Multi-day event crossing range start should be included'
    );
  }

  @isTest
  static void getEventsForMonth_filtersByOwnerIds() {
    User other = buildUser('OtherPerson');
    insert other;

    Date start = Date.today();
    Date end = start.addDays(6);
    Datetime slot = Datetime.newInstance(
      start.addDays(1),
      Time.newInstance(10, 0, 0, 0)
    );

    Event otherEvent;
    System.runAs(other) {
      otherEvent = new Event(
        Subject = 'Other Event',
        ActivityDateTime = slot,
        DurationInMinutes = 60
      );
      insert otherEvent;
    }

    Event myEvent = new Event(
      Subject = 'My Event',
      ActivityDateTime = slot.addHours(1),
      DurationInMinutes = 60
    );
    insert myEvent;

    Test.startTest();
    List<Event> result = PhoneCalendarController.getEventsForMonth(
      String.valueOf(start),
      String.valueOf(end),
      new List<Id>{ UserInfo.getUserId() }
    );
    Test.stopTest();

    Set<Id> ids = new Set<Id>();
    for (Event e : result) {
      ids.add(e.Id);
    }
    System.assert(ids.contains(myEvent.Id), 'Own event should be returned');
    System.assert(
      !ids.contains(otherEvent.Id),
      'Other user event should NOT be returned'
    );
  }

  // ─── getPublicCalendars ────────────────────────────────────────────────────

  @isTest
  static void getPublicCalendars_executesWithoutError() {
    // Calendar レコードはテストで DML 作成できないためスモークテストのみ
    Test.startTest();
    List<Calendar> result = PhoneCalendarController.getPublicCalendars();
    Test.stopTest();
    System.assertNotEquals(null, result, 'Result should not be null');
  }

  // ─── getCalendarPreference ─────────────────────────────────────────────────

  @isTest
  static void getCalendarPreference_returnsNullWhenNoPrefSaved() {
    Test.startTest();
    String result = PhoneCalendarController.getCalendarPreference();
    Test.stopTest();
    System.assertEquals(
      null,
      result,
      'Should return null when no preference exists'
    );
  }

  @isTest
  static void getCalendarPreference_returnsSavedValue() {
    String saved = 'id001,id002';
    insert new PhoneCalendarPref__c(
      SetupOwnerId = UserInfo.getUserId(),
      SelectedUserIds__c = saved
    );

    Test.startTest();
    String result = PhoneCalendarController.getCalendarPreference();
    Test.stopTest();

    System.assertEquals(
      saved,
      result,
      'Should return the stored preference string'
    );
  }

  // ─── saveCalendarPreference ────────────────────────────────────────────────

  @isTest
  static void saveCalendarPreference_createsRecordOnFirstSave() {
    String ids = 'u001,u002,u003';

    Test.startTest();
    PhoneCalendarController.saveCalendarPreference(ids);
    Test.stopTest();

    PhoneCalendarPref__c pref = PhoneCalendarPref__c.getInstance(
      UserInfo.getUserId()
    );
    System.assertNotEquals(null, pref, 'Pref record should be created');
    System.assertEquals(
      ids,
      pref.SelectedUserIds__c,
      'Saved value should match'
    );
  }

  @isTest
  static void saveCalendarPreference_updatesExistingRecord() {
    insert new PhoneCalendarPref__c(
      SetupOwnerId = UserInfo.getUserId(),
      SelectedUserIds__c = 'old001,old002'
    );

    String updated = 'new001,new002,new003';

    Test.startTest();
    PhoneCalendarController.saveCalendarPreference(updated);
    Test.stopTest();

    PhoneCalendarPref__c pref = PhoneCalendarPref__c.getInstance(
      UserInfo.getUserId()
    );
    System.assertEquals(
      updated,
      pref.SelectedUserIds__c,
      'Preference should be updated in place'
    );
  }

  // ─── createEvent ──────────────────────────────────────────────────────────

  @isTest
  static void createEvent_nullInputThrows() {
    Boolean threw = false;
    Test.startTest();
    try {
      PhoneCalendarController.createEvent(null);
    } catch (AuraHandledException e) {
      threw = true;
    }
    Test.stopTest();
    System.assert(threw, 'null input should throw AuraHandledException');
  }

  @isTest
  static void createEvent_blankSubjectThrows() {
    PhoneCalendarController.EventInput input = new PhoneCalendarController.EventInput();
    input.subject = '';
    input.startDateTime = '2025-06-01T09:00:00.000Z';

    Boolean threw = false;
    Test.startTest();
    try {
      PhoneCalendarController.createEvent(input);
    } catch (AuraHandledException e) {
      threw = true;
    }
    Test.stopTest();
    System.assert(threw, 'Blank subject should throw AuraHandledException');
  }

  @isTest
  static void createEvent_blankStartDateTimeThrows() {
    PhoneCalendarController.EventInput input = new PhoneCalendarController.EventInput();
    input.subject = 'Meeting';
    input.startDateTime = '';

    Boolean threw = false;
    Test.startTest();
    try {
      PhoneCalendarController.createEvent(input);
    } catch (AuraHandledException e) {
      threw = true;
    }
    Test.stopTest();
    System.assert(
      threw,
      'Blank startDateTime should throw AuraHandledException'
    );
  }

  @isTest
  static void createEvent_createsEventWithCorrectFields() {
    PhoneCalendarController.EventInput input = new PhoneCalendarController.EventInput();
    input.subject = 'Team Meeting';
    input.startDateTime = '2025-06-10T09:00:00.000Z';
    input.endDateTime = '2025-06-10T10:00:00.000Z';
    input.description = 'Weekly sync';

    Test.startTest();
    Id newId = PhoneCalendarController.createEvent(input);
    Test.stopTest();

    System.assertNotEquals(null, newId, 'Should return a valid Event Id');
    Event ev = [
      SELECT Subject, DurationInMinutes, Description
      FROM Event
      WHERE Id = :newId
    ];
    System.assertEquals('Team Meeting', ev.Subject, 'Subject should match');
    System.assertEquals(60, ev.DurationInMinutes, 'Duration should be 60 min');
    System.assertEquals(
      'Weekly sync',
      ev.Description,
      'Description should match'
    );
  }

  @isTest
  static void createEvent_omittedEndDateTimeDefaultsTo60Minutes() {
    PhoneCalendarController.EventInput input = new PhoneCalendarController.EventInput();
    input.subject = 'Quick Standup';
    input.startDateTime = '2025-06-10T09:00:00.000Z';
    // endDateTime は省略

    Test.startTest();
    Id newId = PhoneCalendarController.createEvent(input);
    Test.stopTest();

    Event ev = [SELECT DurationInMinutes FROM Event WHERE Id = :newId];
    System.assertEquals(
      60,
      ev.DurationInMinutes,
      'Omitted endDateTime should default to 60 min duration'
    );
  }

  @isTest
  static void createEvent_endBeforeStartDefaultsTo60Minutes() {
    // endDateTime が startDateTime より前 → durationMins <= 0 → 60 にフォールバック
    PhoneCalendarController.EventInput input = new PhoneCalendarController.EventInput();
    input.subject = 'Backwards Meeting';
    input.startDateTime = '2025-06-10T10:00:00.000Z';
    input.endDateTime = '2025-06-10T09:00:00.000Z'; // 1 時間前

    Test.startTest();
    Id newId = PhoneCalendarController.createEvent(input);
    Test.stopTest();

    Event ev = [SELECT DurationInMinutes FROM Event WHERE Id = :newId];
    System.assertEquals(
      60,
      ev.DurationInMinutes,
      'Negative duration should fall back to 60 min'
    );
  }
}
