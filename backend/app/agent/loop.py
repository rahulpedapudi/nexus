from app.models.user import User
from sqlalchemy.orm import Session
from app.core.config import settings
from app.agent.tools.tool_executor import execute_tool
from app.agent.tools.registry import TOOLS
from groq import AsyncGroq
import json
import logging

logger = logging.getLogger(__name__)

async def run_agent(messages, db:Session, user: User, api_key: str):
    client = AsyncGroq(api_key=api_key)
    while True:
        response = await client.chat.completions.create(
            messages=messages,
            model=settings.MODEL,
            tools=TOOLS,
            tool_choice="auto"
        )

        assistant_message = response.choices[0].message
        logger.info(assistant_message)
        tool_calls = assistant_message.tool_calls

        if not tool_calls:
            break

        messages.append(assistant_message)

        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            # tell the UI which tool is running
            # yield f"__TOOL_START__{tool_name}__"

            tool_result = execute_tool(
                tool_name=tool_name,
                user=user,
                db=db,
                arguments=arguments
            )

            # yield f"__TOOL_END__{tool_name}"    

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result),
            })
