from datetime import datetime, timedelta, timezone


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
