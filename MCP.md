# Recommended: DBHub MCP

npm install -g @bytebase/dbhub@latest
claude mcp add --transport stdio bookbeam-local-dev-db -- dbhub --transport stdio --dsn "postgresql://bookbeam:bookbeam_dev@localhost:5432/bookbeam"