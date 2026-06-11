import os
from groq import Groq
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.schemas.message import MessageCreate

load_dotenv()

client = Groq(
    api_key=os.getenv("GRQO_API_KEY")
)


def stream_llm_response(recent_messages):
    chat_completion = client.chat.completions.create(
        messages=recent_messages,
        model="openai/gpt-oss-20b"
    )

    llm_response = chat_completion.choices[0].message.content

    return llm_response
