from app.models.user import User
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
from app.agent.tools.integrations.google.auth import get_credentials
from app.services.google.gmail_service import list_email_metadata, get_email_by_id
from app.agent.tools.registry import registry


def get_gmail_service(db: Session, user_id):
    creds = get_credentials(db, user_id)
    return build("gmail", "v1", credentials=creds)


def tool_get_email_by_id(db: Session, user: User, id: str):
    service = get_gmail_service(db, user.id)
    return get_email_by_id(service, id)


def tool_list_email_metadata(db: Session, user: User, query: str, max_results: int = 10):
    service = get_gmail_service(db, user.id)
    return list_email_metadata(service, query, max_results)


_READ_EMAIL_BY_ID_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_email_by_id",
        "description": (
            "Retrieve the full contents of a specific email by its message ID. "
            "Returns the email metadata and decoded body. "
            "Use this after obtaining a message ID from a metadata search when the user "
            "wants to read, summarize, analyze, answer questions about, or extract "
            "information from a specific email. "
            "The returned data includes the sender, recipients, subject, date, snippet, "
            "labels, and the cleaned plain-text email body. "
            "Do not use this function to search for emails; use the email metadata search "
            "function first to locate the desired message."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": (
                        "The Gmail message ID of the email to retrieve. "
                        "This ID should come from a previous email metadata search."
                    )
                }
            },
            "required": ["id"]
        }
    }
}

_LIST_EMAIL_METADATA_SCHEMA = {
    "type": "function",
    "function": {
        "name": "list_email_metadata",
        "description": (
            "Search for emails and return metadata only. "
            "Metadata includes sender, recipients, subject, date, labels, snippet, "
            "message ID, thread ID, and whether the email is unread. "
            "Use this function when the user wants to browse, search, or summarize emails "
            "without reading the full email body."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "A Gmail search query. Multiple search operators can be combined "
                        "using spaces (AND), OR, parentheses, and negation (-).\n\n"
                        "Supported operators:\n"
                        "- from:<email or name> — Sender.\n"
                        "- to:<email> — Recipient.\n"
                        "- cc:<email> — CC recipient.\n"
                        "- bcc:<email> — BCC recipient.\n"
                        "- subject:<text> — Subject contains text.\n"
                        "- label:<label> — Specific label.\n"
                        "- category:primary|social|promotions|updates|forums — Gmail category.\n"
                        "- is:unread, is:read, is:starred, is:important, is:snoozed.\n"
                        "- has:attachment — Emails with attachments.\n"
                        "- filename:<name or extension> — Attachment filename (e.g. filename:pdf).\n"
                        "- after:YYYY/MM/DD — Emails after a date.\n"
                        "- before:YYYY/MM/DD — Emails before a date.\n"
                        "- newer_than:<n>d|m|y — Newer than N days/months/years.\n"
                        "- older_than:<n>d|m|y — Older than N days/months/years.\n"
                        "- larger:<size> — Larger than a size (e.g. 5M, 500K).\n"
                        "- smaller:<size> — Smaller than a size.\n"
                        "- in:inbox|spam|trash|sent|drafts|anywhere.\n"
                        "- deliveredto:<email> — Delivered-to address.\n"
                        "- list:<mailing list> — Mailing list emails.\n"
                        "- rfc822msgid:<message-id> — Search by RFC822 Message-ID.\n"
                        "- has:drive, has:document, has:spreadsheet, has:presentation.\n"
                        "- AND is implied by spaces.\n"
                        "- OR for logical OR.\n"
                        "- Parentheses () for grouping.\n"
                        "- Prefix '-' to exclude a term.\n\n"
                        "Examples:\n"
                        "- is:unread\n"
                        "- from:github newer_than:7d\n"
                        "- subject:invoice has:attachment filename:pdf\n"
                        "- label:important after:2026/01/01\n"
                        "- is:unread (from:github OR from:openai.com)\n"
                        "- -category:promotions newer_than:30d\n"
                        "- larger:5M has:attachment\n"
                        "- in:sent to:alice@example.com\n"
                        "Leave empty to retrieve the most recent emails."
                    ),
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of emails to return.",
                    "default": 10,
                    "minimum": 1,
                    "maximum": 100
                }
            },
            "required": ["query", "max_results"]
        }
    }
}


def register():
    registry.register(_LIST_EMAIL_METADATA_SCHEMA, tool_list_email_metadata)
    registry.register(_READ_EMAIL_BY_ID_SCHEMA, tool_get_email_by_id)
