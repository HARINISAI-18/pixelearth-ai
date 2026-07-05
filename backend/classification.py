"""LLM-based photo classification via Claude multimodal API."""
import os
import base64
import json
import logging
from pathlib import Path

import anthropic

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


CLASSIFY_PROMPT = """You are an environmental monitoring AI. Analyze this image submitted by a citizen reporter and classify the pollution event.

Return ONLY a JSON object with exactly these fields:
{
  "category": "smoke" | "dust" | "burning" | "clear" | "other",
  "severity": <integer 1-5 where 1=barely noticeable, 5=extreme/hazardous>,
  "confidence": <float 0.0-1.0>,
  "description": "<one sentence describing what you see>"
}

Severity guide:
1 = slight haze or minor dust, negligible health risk
2 = visible smoke/dust but moderate, temporary exposure unlikely harmful
3 = significant smoke or dust, prolonged exposure a concern
4 = heavy smoke, poor visibility, acrid smell likely, health risk for sensitive groups
5 = extreme pollution — dense black smoke, fire flames visible, immediate health hazard

If the image shows no pollution at all, return category "clear" with severity 1."""


def classify_photo(photo_path: str) -> dict:
    """Classify a photo using Claude's vision API. Returns dict with category/severity/confidence."""
    try:
        client = _get_client()
        path = Path(photo_path)
        if not path.exists():
            return _fallback_classification("Photo file not found")

        with open(path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        ext = path.suffix.lower()
        media_type_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                          ".gif": "image/gif", ".webp": "image/webp"}
        media_type = media_type_map.get(ext, "image/jpeg")

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_data}},
                        {"type": "text", "text": CLASSIFY_PROMPT},
                    ],
                }
            ],
        )

        text = message.content[0].text.strip()
        # Extract JSON even if there's surrounding text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            return {
                "category": result.get("category", "other"),
                "severity": int(result.get("severity", 3)),
                "confidence": float(result.get("confidence", 0.7)),
                "description": result.get("description", ""),
            }
        return _fallback_classification("Could not parse LLM response")

    except anthropic.APIConnectionError:
        return _fallback_classification("API connection error")
    except anthropic.AuthenticationError:
        return _fallback_classification("Invalid API key")
    except Exception as e:
        logger.error("Classification failed: %s", e)
        return _fallback_classification(str(e))


def _fallback_classification(reason: str) -> dict:
    """Return a default classification when the API call fails."""
    logger.warning("Using fallback classification: %s", reason)
    return {
        "category": "other",
        "severity": 3,
        "confidence": 0.5,
        "description": f"Auto-classified (API unavailable: {reason})",
    }
