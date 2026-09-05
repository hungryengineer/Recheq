-- Index rate limit counters by window_end so the retention sweep
-- (`DELETE FROM rate_limits WHERE window_end < now() - interval '...'`) can use
-- the index instead of a seq scan, and the upsert expiry check stays bounded.
CREATE INDEX "idx_rate_limits_window_end" ON "rate_limits" USING btree ("window_end");