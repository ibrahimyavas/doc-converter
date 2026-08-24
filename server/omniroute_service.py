"""Thin client for OmniRoute (github.com/diegosouzapw/OmniRoute), a
self-hosted AI gateway exposing an OpenAI-compatible /v1/chat/completions
endpoint. Used to turn extracted PDF text into a summary, study guide, or
flashcard set.
"""

import os
import time

import requests

MAX_INPUT_CHARS = 40_000  # ~10k tokens — plenty for a summary/study guide,
# keeps requests fast and bounds cost/abuse regardless of source PDF size.

_PROMPTS = {
    "summary": (
        "You are a concise technical summarizer. Summarize the following document "
        "in 3-6 short paragraphs, covering its main points and conclusions. "
        "Do not pad with filler like 'this document discusses' — get straight to content."
    ),
    "study_guide": (
        "You are a study-guide writer. Turn the following document into a structured "
        "study guide: a short overview, then key concepts as headed sections with "
        "bullet points, then a 'key terms' list with one-line definitions. Use markdown "
        "headings and bullets."
    ),
    "flashcards": (
        "You are a flashcard generator. Read the following document and produce 8-15 "
        "question/answer flashcards covering its most important, testable points. "
        "Format each as:\nQ: <question>\nA: <answer>\n\nwith a blank line between cards. "
        "No preamble, no numbering, just the cards."
    ),
}


class OmniRouteNotConfigured(Exception):
    """Raised when OMNIROUTE_API_KEY is missing."""


class OmniRouteError(Exception):
    """Raised when OmniRoute accepts the request but generation fails."""


def generate_study_content(text: str, mode: str) -> str:
    api_key = os.getenv("OMNIROUTE_API_KEY")
    if not api_key:
        raise OmniRouteNotConfigured(
            "OMNIROUTE_API_KEY is not set. Add one to server/.env and restart the server."
        )

    system_prompt = _PROMPTS.get(mode)
    if not system_prompt:
        raise OmniRouteError(f"Unknown study mode: {mode!r}. Use summary, study_guide, or flashcards.")

    base_url = os.getenv("OMNIROUTE_BASE_URL", "http://localhost:20128/v1").rstrip("/")
    model = os.getenv("OMNIROUTE_MODEL", "auto/best-chat")
    truncated = text[:MAX_INPUT_CHARS]

    # OmniRoute's free-tier pool routes across community providers that are
    # individually flaky (429s are common and usually transient — a
    # different provider in the pool succeeds a moment later), so retry
    # once before giving up.
    # The loop below always either `break`s (success) or `raise`s (final
    # failure) — it never falls through — so anything after it can assume
    # `response.status_code < 400`.
    for attempt in range(2):
        try:
            response = requests.post(
                f"{base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": truncated},
                    ],
                },
                timeout=120,
            )
        except requests.RequestException as exc:
            raise OmniRouteError(f"Could not reach OmniRoute at {base_url}: {exc}") from exc

        if response.status_code < 400:
            break

        try:
            detail = response.json().get("error", {}).get("message")
        except ValueError:
            detail = response.text[:300]
        error_message = f"OmniRoute returned {response.status_code}: {detail or 'no details'}"

        if response.status_code == 429 and attempt == 0:
            time.sleep(2)
            continue
        raise OmniRouteError(error_message)

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise OmniRouteError("OmniRoute returned no choices.")

    content = (choices[0].get("message") or {}).get("content")
    if not content:
        raise OmniRouteError("OmniRoute returned an empty response.")

    return content
