-- Change detection that does not move when the page does not.
--
-- `contentHash` is sha256 over the raw HTML. Two fetches of the Osijek cinema
-- programme ten minutes apart were both 314 079 bytes with different hashes —
-- a nonce — so every check re-parsed the page and queued all 34 events again.
-- The extracted text of those two fetches was byte-identical.
--
-- `contentHash` is kept and still written, so a rollback to the previous
-- release keeps working off a value it understands.
ALTER TABLE "MonitoredSource" ADD COLUMN "contentFingerprint" TEXT;
ALTER TABLE "MonitoredSource" ADD COLUMN "lastFullParseAt" TIMESTAMP(3);

-- Every existing source has no fingerprint yet, so its next check parses in
-- full once and records one. That is the intended behaviour: it is the parse
-- that establishes the baseline.
