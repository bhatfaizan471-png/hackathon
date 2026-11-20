from datetime import datetime, timezone
from typing import Dict, Tuple, Optional

class AlertManager:
    """
    Manages alert triggering and cooldown suppression.
    Default cooldown window is 120s (from config/thresholds.json).
    """
    def __init__(self, cooldown_seconds: int = 120):
        self.cooldown_seconds = cooldown_seconds
        # (tenant_id, source_id, category) -> last_alert_time
        self._last_alert_times: Dict[Tuple[str, str, str], datetime] = {}

    def should_emit_alert(
        self,
        tenant_id: str,
        source_id: str,
        category: str,
        current_time: Optional[datetime] = None,
    ) -> bool:
        now = current_time or datetime.now(timezone.utc)
        key = (tenant_id, source_id, category)
        last_time = self._last_alert_times.get(key)

        if last_time is not None:
            elapsed = (now - last_time).total_seconds()
            if elapsed < self.cooldown_seconds:
                # Inside cooldown: suppress duplicate alert
                return False

        self._last_alert_times[key] = now
        return True

    def reset(self):
        self._last_alert_times.clear()
