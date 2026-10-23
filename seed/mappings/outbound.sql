-- Outbound (Apollo) mapping, hand-written: contacts are counted once, on their first send.
-- MQL = external contact who replied, never bounced, not Bad Data. SQL = MQL whose stage is Interested.
WITH emails AS (
  SELECT LOWER(TRIM(TO_EMAIL)) AS contact, SENT_AT_PST::DATE AS day, COALESCE(SEQUENCE, '(no sequence)') AS SEQUENCE, SUBJECT, TO_COMPANY,
         SENT, BOUNCE, OPEN, CLICK, REPLIED, UNSUBSCRIBE, CONTACT_STAGE
  FROM CMO_DB.CH_OUTBOUND.RAW_DATASAUR_OUTBOUND_EMAILS
  WHERE TO_EMAIL IS NOT NULL AND LOWER(TO_EMAIL) NOT LIKE '%datasaur%'
),
contacts AS (
  SELECT contact,
         MIN(day) AS first_day, MIN_BY(SEQUENCE, day) AS first_sequence,
         BOOLOR_AGG(REPLIED) AND NOT BOOLOR_AGG(BOUNCE) AND NOT BOOLOR_AGG(CONTACT_STAGE = 'Bad Data') AS is_mql,
         BOOLOR_AGG(CONTACT_STAGE = 'Interested') AS interested
  FROM emails GROUP BY contact
),
stages AS (
  SELECT first_day AS day, first_sequence AS sequence, COUNT(*) AS new_contacts,
         COUNT_IF(is_mql) AS mqls, COUNT_IF(is_mql AND interested) AS sqls
  FROM contacts GROUP BY 1, 2
),
activity AS (
  SELECT day, SEQUENCE AS sequence, COUNT_IF(SENT) AS emails_sent, COUNT_IF(BOUNCE) AS bounces, COUNT_IF(OPEN) AS opens,
         COUNT_IF(CLICK) AS clicks, COUNT_IF(REPLIED) AS replies, COUNT_IF(UNSUBSCRIBE) AS unsubscribes,
         MAX(SUBJECT) AS subject, MAX(TO_COMPANY) AS company
  FROM emails GROUP BY 1, 2
)
SELECT a.day AS date, a.sequence AS campaign, NULL::FLOAT AS spend_usd,
       COALESCE(s.mqls, 0)::FLOAT AS mqls, COALESCE(s.sqls, 0)::FLOAT AS sqls,
       NULL::FLOAT AS opps, NULL::FLOAT AS pipeline_usd, NULL::FLOAT AS won, NULL::FLOAT AS won_acv_usd,
       a.subject AS creative_text, a.company AS audience,
       OBJECT_CONSTRUCT('emails_sent', a.emails_sent, 'bounces', a.bounces, 'opens', a.opens, 'clicks', a.clicks,
                        'replies', a.replies, 'unsubscribes', a.unsubscribes, 'new_contacts', COALESCE(s.new_contacts, 0)) AS metrics
FROM activity a LEFT JOIN stages s ON s.day = a.day AND s.sequence = a.sequence
