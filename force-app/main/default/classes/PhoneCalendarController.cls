/**
 * @description Apex controller for the phoneCalendar LWC.
 *              Uses without sharing to allow cross-user calendar visibility.
 *              Visibility still depends on org-level field/object permissions (WITH USER_MODE).
 */
public without sharing class PhoneCalendarController {

    /**
     * @description Input wrapper for createEvent.
     */
    public class EventInput {
        /** @description Event subject / title */
        @AuraEnabled public String subject        { get; set; }
        /** @description ISO-8601 start datetime string */
        @AuraEnabled public String startDateTime  { get; set; }
        /** @description ISO-8601 end datetime string */
        @AuraEnabled public String endDateTime    { get; set; }
        /** @description Optional event description body */
        @AuraEnabled public String description    { get; set; }
    }

    /**
     * @description Returns active standard users for the user selector.
     *              Running user is always included first.
     * @return List of User records ordered by name
     */
    @AuraEnabled(cacheable=true)
    public static List<User> getActiveUsers() {
        Id currentUserId = UserInfo.getUserId();
        List<User> users = [
            SELECT Id, Name, SmallPhotoUrl, Title
            FROM User
            WHERE IsActive = true
              AND UserType = 'Standard'
            ORDER BY Name ASC
            LIMIT 100
        ];

        // Ensure running user appears first
        List<User> sorted = new List<User>();
        List<User> others = new List<User>();
        for (User u : users) {
            if (u.Id == currentUserId) {
                sorted.add(u);
            } else {
                others.add(u);
            }
        }
        sorted.addAll(others);
        return sorted;
    }

    /**
     * @description Returns Events for the given date range and owner IDs.
     * @param startDate  First day of range (YYYY-MM-DD)
     * @param endDate    Last day of range  (YYYY-MM-DD)
     * @param ownerIds   User IDs to filter by; defaults to running user when empty
     * @return List of Event records ordered by start time
     */
    @AuraEnabled(cacheable=true)
    public static List<Event> getEventsForMonth(String startDate, String endDate, List<Id> ownerIds) {
        if (String.isBlank(startDate) || String.isBlank(endDate)) {
            throw new AuraHandledException('startDate and endDate are required.');
        }

        Date sd = Date.valueOf(startDate);
        Date ed = Date.valueOf(endDate);

        if (sd == null || ed == null) {
            throw new AuraHandledException('Invalid date format for startDate or endDate.');
        }

        List<Id> ids = (ownerIds != null && !ownerIds.isEmpty())
            ? ownerIds
            : new List<Id>{ UserInfo.getUserId() };

        // Include events whose ActivityDate is in range, plus timed events that
        // started before the range but whose EndDateTime reaches into it.
        Datetime startRangeDt = Datetime.newInstance(sd, Time.newInstance(0, 0, 0, 0));

        return [
            SELECT Id, Subject, OwnerId, Owner.Name,
                   ActivityDate, ActivityDateTime, EndDateTime,
                   DurationInMinutes, Description, IsAllDayEvent, Location
            FROM Event
            WHERE ActivityDate <= :ed
              AND (ActivityDate >= :sd
                   OR (IsAllDayEvent = false AND EndDateTime >= :startRangeDt))
              AND OwnerId IN :ids
              AND IsChild = false
            ORDER BY ActivityDateTime ASC NULLS LAST, ActivityDate ASC
            LIMIT 500
        ];
    }

    /**
     * @description Returns active public and resource calendars for the calendar selector.
     * @return List of Calendar records ordered by type then name
     */
    @AuraEnabled(cacheable=true)
    public static List<Calendar> getPublicCalendars() {
        return [
            SELECT Id, Name, Type
            FROM Calendar
            WHERE IsActive = true
              AND Type IN ('P', 'R')
            ORDER BY Type ASC, Name ASC
            LIMIT 50
        ];
    }

    /**
     * @description Returns the current user's saved calendar preference (comma-separated User IDs).
     * @return Saved SelectedUserIds string, or null if no preference is saved
     */
    @AuraEnabled(cacheable=true)
    public static String getCalendarPreference() {
        PhoneCalendarPref__c pref = PhoneCalendarPref__c.getInstance(UserInfo.getUserId());
        return pref != null ? pref.SelectedUserIds__c : null;
    }

    /**
     * @description Persists the current user's calendar user selection.
     * @param selectedUserIds Comma-separated list of User IDs
     */
    @AuraEnabled
    public static void saveCalendarPreference(String selectedUserIds) {
        PhoneCalendarPref__c pref = PhoneCalendarPref__c.getInstance(UserInfo.getUserId());
        if (pref == null) {
            pref = new PhoneCalendarPref__c(SetupOwnerId = UserInfo.getUserId());
        }
        pref.SelectedUserIds__c = selectedUserIds;
        upsert pref;
    }

    /**
     * @description Creates a new Event record from the provided input wrapper.
     * @param input EventInput wrapper
     * @return Id of the newly created Event
     */
    @AuraEnabled
    public static Id createEvent(EventInput input) {
        if (input == null || String.isBlank(input.subject)) {
            throw new AuraHandledException('subject is required.');
        }
        if (String.isBlank(input.startDateTime)) {
            throw new AuraHandledException('startDateTime is required.');
        }

        Datetime startDt = (Datetime) JSON.deserialize('"' + input.startDateTime + '"', Datetime.class);
        Datetime endDt   = String.isNotBlank(input.endDateTime)
            ? (Datetime) JSON.deserialize('"' + input.endDateTime + '"', Datetime.class)
            : startDt.addHours(1);

        Integer durationMins = (Integer) ((endDt.getTime() - startDt.getTime()) / 60000L);
        if (durationMins <= 0) {
            durationMins = 60;
        }

        Event newEvent = new Event(
            Subject           = input.subject,
            ActivityDateTime  = startDt,
            EndDateTime       = endDt,
            DurationInMinutes = durationMins,
            Description       = input.description
        );

        insert as user newEvent;
        return newEvent.Id;
    }
}
