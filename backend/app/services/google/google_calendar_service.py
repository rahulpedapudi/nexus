from datetime import datetime, timedelta


def fetch_events():
    pass


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
