import asyncio
from composio import Composio
from claude_agent_sdk import query, ClaudeAgentOptions

composio = Composio()
user_id = "user_1umlp8"

# Create a tool router session
session = composio.create(user_id=user_id)

# Query Claude with MCP tools
async def main():
    options = ClaudeAgentOptions(
        system_prompt="You are a helpful assistant",
        permission_mode="bypassPermissions",
        mcp_servers={
            "composio": {
                "type": session.mcp.type,
                "url": session.mcp.url,
                "headers": session.mcp.headers,
            }
        },
    )

    async for message in query(
        prompt="Star the composiohq/composio repo on GitHub",
        options=options,
    ):
        print(message)

asyncio.run(main())
