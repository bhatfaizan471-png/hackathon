import math
from typing import Dict, Any, Tuple

class BaselineTracker:
    """
    EWMA (Exponentially Weighted Moving Average) and Z-score / Threshold anomaly detector.
    Matches config/thresholds.json specifications.
    """
    def __init__(self, alpha: float = 0.1, warmup_samples: int = 5, sustain_samples: int = 2):
        self.alpha = alpha
        self.warmup_samples = warmup_samples
        self.sustain_samples = sustain_samples
        self.baselines: Dict[str, Dict[str, Any]] = {}

    def update(self, key: str, value: float, threshold: float = 75.0) -> Tuple[float, float, int]:
        if key not in self.baselines:
            self.baselines[key] = {
                "ewma": value,
                "ewmv": 4.0,  # nominal baseline std dev ~ 2.0
                "count": 1,
                "consecutive_breaches": 0,
            }
            return value, 0.0, 0

        b = self.baselines[key]
        b["count"] += 1
        diff = value - b["ewma"]
        std_dev = math.max(0.5, math.sqrt(max(0.25, b["ewmv"]))) if hasattr(math, "max") else max(0.5, math.sqrt(max(0.25, b["ewmv"])))
        z_score = diff / std_dev

        # Update baseline statistics slowly
        if value < threshold:
            b["ewma"] += self.alpha * diff
            b["ewmv"] = (1 - self.alpha) * b["ewmv"] + self.alpha * (diff ** 2)

        # A breach is flagged if value exceeds threshold (e.g. 75% / 90%) or extreme Z-score (> 3.0)
        is_breach = (value >= threshold) or (z_score >= 3.0)

        if is_breach:
            b["consecutive_breaches"] += 1
        else:
            b["consecutive_breaches"] = 0

        return b["ewma"], z_score, b["consecutive_breaches"]

    def is_sustained_anomaly(self, key: str) -> bool:
        b = self.baselines.get(key)
        if not b:
            return False
        return b["consecutive_breaches"] >= self.sustain_samples
