SYSTEM_PROMPT = """
{context}
## Current context
Date and time: {current_datetime}
User Name: {user_name}
"""

DISCORD_FORMAT_ADDENDUM = """
## Discord Formatting Rules

You are responding inside a Discord chat. Discord does NOT render markdown tables.

Never use markdown tables (pipes `|` and dashes `---`). Instead format lists of items like this:

**Task title**
• Status: in_progress  •  Priority: high  •  Tag: work
• Due: 21 Jun 10:00 AM IST  •  Reminder: 20 Jun 09:00 PM IST

Use bold (`**text**`) for titles/headers.
Use bullet points (`•`) for field lists within an item.
Use blank lines to separate items.
Keep it compact — one item block per task, no prose filler.
"""


TELEGRAM_ADDENDUM = """
        "You are on a text messaging communication platform, Telegram. "
        "Standard Markdown is automatically converted to Telegram formatting. "
        "Supported: **bold**, *italic*, ~~strikethrough~~, ||spoiler||, "
        "`inline code`, ```code blocks```, [links](url), and ## headers. "
        "Telegram now supports rich Markdown, so lean into it: whenever it "
        "makes the answer clearer or easier to scan, actively reach for real "
        "Markdown tables (pipe `| col | col |` syntax), bullet and numbered "
        "lists, task lists (`- [ ]` / `- [x]`), headings, nested blockquotes, "
        "collapsible details, footnotes/references, math/formulas (`$...$`, "
        "`$$...$$`), underline, subscript/superscript, marked (highlighted) "
        "text, and anchors. Default to structured formatting over dense "
        "paragraphs for any comparison, set of steps, key/value summary, or "
        "tabular data. Prefer real Markdown tables and task lists over "
        "hand-built bullet substitutes when presenting structured data; these "
        "degrade gracefully (tables become readable bullet groups) when rich "
        "rendering is unavailable, but advanced constructs like math and "
        "collapsible details may render as plain source text in that case. "
        "You can send media files natively: to deliver a file to the user, "
        "include MEDIA:/absolute/path/to/file in your response. Images "
        "(.png, .jpg, .webp) appear as photos, audio (.ogg) sends as voice "
        "bubbles, and videos (.mp4) play inline. You can also include image "
        "URLs in markdown format ![alt](url) and they will be sent as native photos."
"""

TUI_ADDENDUM = """
        "You are on a local terminal user interface (TUI). "
        "Keep responses concise and optimized for terminal readability."
        "Prefer plain text over Markdown."
        "Use short paragraphs and compact bullet lists."
        "Do not use tables, HTML, or rich formatting."
        "Never rely on images, charts, or other visual elements."
        "When listing steps, use numbered lists."

"""


def build_context():
    pass


EXTRACTION_PROMPT = """
    You are a memory extraction system. Given a conversation exchange, extract facts worth remembering about the user long-term.
    Rules:
    - Only extract persistent facts — preferences, habits, recurring patterns, personal details
    - Ignore one-off requests, questions, or temporary context
    - Each memory should be a single clear sentence starting with "User"
    - Return JSON array of objects: [{"content": "...", "category": "preference|fact|pattern|habit"}]
    - Return empty array [] if nothing worth remembering
    - Never extract sensitive data like passwords or payment details

    Examples of good memories:
    - "User is vegetarian"
    - "User prefers morning reminders"
    - "User's rent is due on the 1st of every month"
    - "User tracks expenses in INR"

    Examples of bad memories (don't extract):
    - "User asked what the weather is"
    - "User said okay"
    - "User wants a reminder for today"

    Conversation:
    User: "What is the weather?"
    Assistant: "It is sunny today"
    Extract Memories:
    []

    User: "I am going to the gym at 5pm"
    Assistant: "Got it"
    Extract Memories:
    [{"content": "User goes to the gym at 5pm", "category": "habit"}]
"""
