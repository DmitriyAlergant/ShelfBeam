# Recommended: DBHub MCP

npm install -g @bytebase/dbhub@latest
claude mcp add --transport stdio bookbeam-local-dev-db -- dbhub --transport stdio --dsn "postgres://postgres:(POSTGRES_MASTER_PASSWORD)@localhost:5432/bookbeam"