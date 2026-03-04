This is an app helping kids choose books from to read from a library bookself. Snap a pic of a library shelf, AI discovers the books (object detection model -> OCR -> library metadata lookups) and provides personalized recommendations given prior user history. This is for a 2-day hackathon, so moving quickly - but needs to be presentable. Not feature rich, but look great. 

Tech Stack:
    Expo Go + React Native (runs natively on Mac, NOT in Docker)
    App Backend (BFF): Express + Drizzle ORM
    Auth: Clerk
    Database: Postgres (Docker Compose locally)
    Processing Pipeline: Python workers in a container (models tbd)
    LLM API Endpoint to be provided
    Image Storage: Local volume mount (S3-compatible if needed later)

## Dev Environment

Local development uses Docker Compose for backend services + Expo CLI on the host Mac for the React Native app.

```
docker-compose.yml
├── postgres         (port 5432)
├── app-backend      (Express, port 3000, source volume-mounted for hot reload)
├── worker           (Python, source volume-mounted for hot reload)

Host Mac (not Docker):
└── expo start       (React Native — iOS Simulator, Android Emulator, Expo Go)
```

## Testing Strategy

| Layer | Tool | Notes |
|-------|------|-------|
| app-backend API | vitest + supertest (or curl) | All endpoints, scan workflow, book CRUD |
| Python pipeline | pytest | Workers in isolation |
| React Native UI | iOS Simulator + Expo Go on device | Manual testing; Maestro if time permits |
| Agentic validation | Claude Code + curl/API calls | Per "test whenever possible" rule |

Screen Designs: `./designs/screen-map.md`
Data Model: `./designs/data-model.md`
Design Guidelines: `./designs/design-guidelines.md`

## Agentic Rules

TEST WHENEVER POSSIBLE (backend). If you created something that can be tested or validated from bash/curl/cli/API call, validate.

NO DEFAULTS FOR ENV VARS: All Env vars must be defined in the .env template, if something is missing, docker compose will show a visible warning on a missing env vars. Do not provide defaults for env vars in docker compose, application code, or jinja templates. In Python, prefer `os.environ["VAR"]` syntax and not os.getenv to force an unhandled exception if we forgot to defined the variable. In node.js use `const VAR = process.env.VAR ?? (() => { throw new Error('Missing required env VAR') })()`;

NO SUPPRESSION OF EXCEPTIONS: Unless specifically requested by a user, do not consume exceptions. Rely on application-level generic exceptions handling. Only try/catch exceptions when a specific error needs to be shown to the application consumer via frontend, and even then consider whether the exception needs to be re-thrown. When unsure, discuss options on exceptions handling with the user. BAD PATTERN: "try, catch Exception, log a warning, do nothing else, do not rethrow". 

NO FALLBACKS unless specifically requested by a user. Do not overcomplicate the code by different attempts and fallbacks of doing same thing. No fallbacks. Process as intended, or fail hard.

NO ARGS AND RETURNS in docstrings. Python docstrings are nice but only explain what the method is doing, do not describe each args or return type (unless very unorthodox).

LOCAL DEV DATABASE ACCESS. You may have mcp server providing execute_sql tool (or similar), use that to connect to the local Postgres database. If no MCP tool is enabled, ask the user to enable it — see `MCP.md`.

NO DATABASE CONSTRAINTS

COMMIT OFTEN once validated that the feature is running:

WHEN WORKING ON A PLAN assume the implementation agent is just as smart as you, most often IT IS a copy of yourself. Keep plans higher level for structure and review. DO NOT CODE INSIDE THE PLAN.

HOT RELOAD: all docker compose apps need to mount source code from the monorepo for hot reload (via docker compose, not via app-level Dockerfile). If we ever deploy to production into e.g. railway, that will not be using this docker compose yaml.