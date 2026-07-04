import base64


def _get_email_body(payload):
    if "parts" in payload:
        for part in payload["parts"]:
            if part["mimeType"] == "text/plain":
                data = part["body"].get("data")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8")

        # for part in payload["parts"]:
        #     if part["mimeType"] == "text/html":
        #         data = part["body"].get("data")
        #         if data:
        #             return base64.urlsafe_b64decode(data).decode("utf-8")

    # data = payload.get("body", {}).get("data")
    # if data:
    #     return base64.urlsafe_b64decode(data).decode("utf-8")

    return None


def list_email_metadata(service, query: str = "", max_results: int = 10):
    """
    Gets the top N email metadata.

    Args:
        service: The Gmail service
        query: The query to search for emails
        max_results: The maximum number of emails to return

    Returns:
        list: The list of email metadata
        [
            {
                "id": str,
                "from": str,
                "subject": str,
                "date": str,
                "snippet": str,
            }
        ]
    """
    ids = service.users().messages().list(
        userId="me",
        q=query,
        maxResults=max_results
    ).execute()

    messages = ids.get("messages", [])
    if len(messages) == 0:
        return []

    emails = []

    for email in messages:
        msg = service.users().messages().get(
            userId="me",
            id=email["id"],
            format="metadata",
        ).execute()

        headers = msg.get("payload", {}).get("headers", [])

        # convert headers to dictionary
        header_dict = {}
        for h in headers:
            header_dict[h["name"]] = h["value"]

        emails.append({
            "id": msg["id"],
            "from": header_dict.get("From"),
            "subject": header_dict.get("Subject"),
            "date": header_dict.get("Date"),
            "snippet": msg["snippet"].strip(),
        })

    return emails


def get_email_by_id(service, id: str):
    msg = service.users().messages().get(
        userId="me",
        id=id,
        format="full"
    ).execute()

    formatted_message = _get_email_body(msg["payload"])

    headers = msg.get("payload", {}).get("headers", [])
    header_dict = {}
    for h in headers:
        header_dict[h["name"]] = h["value"]

    return {
        "id": msg["id"],
        "from": header_dict.get("From"),
        "subject": header_dict.get("Subject"),
        "date": header_dict.get("Date"),
        "snippet": msg["snippet"],
        "body": formatted_message,
    }
