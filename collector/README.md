# Collector (Tier 1), built in Stage 3

Python + psutil. Collects, redacts, filters, builds the allow-listed payload, writes the local egress log, buffers in SQLite and sends to the backend. Raw logs never leave this folder's environment.
