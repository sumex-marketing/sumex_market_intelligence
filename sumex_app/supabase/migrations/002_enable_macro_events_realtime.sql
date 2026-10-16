-- Enable Supabase Realtime for macro_events so the client can subscribe
-- to live INSERT / UPDATE / DELETE changes.

-- REPLICA IDENTITY FULL ensures the old row data is included in DELETE payloads,
-- which lets us remove the right row from the client-side state.
ALTER TABLE macro_events REPLICA IDENTITY FULL;

-- Add macro_events to the supabase_realtime publication so Postgres
-- broadcasts change events to connected Realtime clients.
ALTER PUBLICATION supabase_realtime ADD TABLE macro_events;
