FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source is volume-mounted for hot reload in dev
COPY src/ ./src/

CMD ["watchmedo", "auto-restart", "--directory=src", "--pattern=*.py", "--recursive", "--", "python", "-u", "src/main.py"]
