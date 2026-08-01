import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SentimentResult:
    label: str = "neutral"
    confidence: float = 0.0
    positive: float = 0.0
    negative: float = 0.0
    neutral: float = 1.0
    error: str | None = None


class SentimentService:
    """FinBERT is loaded once per process; failures degrade safely to neutral."""

    def __init__(self, enabled: bool = True):
        self.enabled, self.ready, self.model, self.tokenizer, self.device = (
            enabled,
            False,
            None,
            None,
            "cpu",
        )

    def load(self) -> None:
        if not self.enabled or self.ready:
            return
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
            self.model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert").to(
                self.device
            )
            self.model.eval()
            self.ready = True
            logger.info("FinBERT loaded on %s", self.device)
        except Exception as exc:  # model downloads must never stop news ingestion
            logger.warning("FinBERT unavailable; using neutral fallback: %s", exc)

    def analyze(self, text: str) -> SentimentResult:
        if not self.ready or not self.model or not self.tokenizer:
            return SentimentResult(error="FinBERT unavailable")
        try:
            import torch

            encoded = self.tokenizer(
                text or "", return_tensors="pt", truncation=True, max_length=512
            )
            encoded = {key: value.to(self.device) for key, value in encoded.items()}
            with torch.inference_mode():
                values = (
                    torch.softmax(self.model(**encoded).logits[0], dim=0).detach().cpu().tolist()
                )
            labels = [self.model.config.id2label[index].lower() for index in range(len(values))]
            probabilities = dict(zip(labels, values, strict=True))
            normalized = {
                key: probabilities.get(key, 0.0) for key in ("positive", "negative", "neutral")
            }
            label = max(normalized, key=normalized.get)
            return SentimentResult(label, normalized[label], **normalized)
        except Exception as exc:
            logger.exception("FinBERT inference failed")
            return SentimentResult(error=str(exc))
