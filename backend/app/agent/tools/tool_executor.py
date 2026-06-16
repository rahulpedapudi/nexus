from app.agent.tools.registry import AVAILABALE_TOOLS

def execute_tool(
    tool_name,
    arguments,
    db,
    user
):
    func = AVAILABALE_TOOLS.get(tool_name)
    if not func:
        raise Exception("Tool Not Found")
    
    result = func(db=db, user=user, **arguments)
    
    return {"name": tool_name, "result": result}
