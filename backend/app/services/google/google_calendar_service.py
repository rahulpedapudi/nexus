from datetime import datetime, timedelta, timezone


def fetch_today_events(service):
    """
    Return all Google Calendar events for the rest of today (UTC).

    Args:
        service: Authorised Google Calendar API v3 resource.

    Returns:
        list[dict]: Events with summary, start, end, and description.
    """
    now = datetime.now(timezone.utc)
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=0)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end_of_day.isoformat(),
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = []
    for event in result.get("items", []):
        start = event.get("start", {})
        end = event.get("end", {})
        events.append({
            "summary": event.get("summary", "(No title)"),
            "description": event.get("description", ""),
            "start": start.get("dateTime", start.get("date", "")),
            "end": end.get("dateTime", end.get("date", "")),
        })
    return events


def fetch_events(service):
    now = datetime.now(timezone.utc).isoformat()
    events = service.events().list(
        calendarId="primary",
        timeMin=now,
        maxResults=10,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    formated_events = []
    for event in events.get("items", []):
        formated_events.append({
            "summary": event["summary"],
            "description": event["description"],
            "start": event["start"]["dateTime"],
            "end": event["end"]["dateTime"],
            "created": event["created"],
        })
    return formated_events


# TODO: probably add event to the db as well, cuz to update an event i need event_id
def create_event(service, summary: str, description: str, start_time: datetime, end_time: datetime = None):
    if end_time is None:
        end_time = start_time + timedelta(hours=1)

    event_body = {
        "summary": summary,
        "description": description,
        "start": {
            "dateTime": start_time,
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": end_time,
            "timeZone": "UTC",
        },
    }

    event = service.events().insert(calendarId="primary", body=event_body).execute()

    return event


def update_event():
    pass


def delete_event():
    pass
