from typing import Callable, Any
from app.models.user import User
from sqlalchemy.orm import Session


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, tuple[dict, Callable]] = {}

    def register(self, schema: dict, handler: Callable):
        name = schema["function"]["name"]
        self._tools[name] = (schema, handler)

    @property
    def schemas(self) -> list[dict]:
        return [schema for schema, _ in self._tools.values()]

    def execute(
        self,
        tool_name: str,
        user: User,
        db: Session,
        arguments
    ) -> Any:
        if tool_name not in self._tools:
            raise ValueError(f"Tool {tool_name} not found")

        _schema, handler = self._tools[tool_name]
        return handler(user=user, db=db, **arguments)


registry = ToolRegistry()
