claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
claude mcp add puppeteer -- npx -y @modelcontextprotocol/server-puppeteer
claude mcp add-json context7 '{ type:stdio, command:npx, args:[-y,@upstash/context7-mcp@latest] }'
claude mcp add-json chrome '{ type:stdio, command:npx, args:[@browsermcp/mcp@latest], env:{ ENABLE_MULTI_TAB:true, DEFAULT_SEARCH_ENGINE:brave, MAX_CONCURRENT_TABS:4 } }'
