-- Optional four-hour scheduler for CardSignal.
-- Run only after replacing both placeholders and adding the same CRON_SECRET to Vercel.
-- Supabase Vault keeps the secret out of the cron job definition.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://card-signal-seven.vercel.app/api/cron/portfolio-scan',
  'cardsignal_scan_url'
);

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_CRON_SECRET_USED_IN_VERCEL',
  'cardsignal_cron_secret'
);

select cron.schedule(
  'cardsignal-portfolio-scan-every-four-hours',
  '17 */4 * * *',
  $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'cardsignal_scan_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cardsignal_cron_secret')
      )
    );
  $$
);
