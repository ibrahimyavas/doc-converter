FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8787
EXPOSE 8787

# CLOUDCONVERT_API_KEY / CORS_ORIGIN are read from the environment at
# runtime (pass them via `docker run -e ...` or your host's env config,
# not baked into the image).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
