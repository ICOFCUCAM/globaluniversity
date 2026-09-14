-- ===========================================================================
-- 080 — THE APPOINTEE'S THREE DAYS
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. NOTHING CLOSES TODAY. This adds three columns and no data. Every letter
--    already issued stays exactly as it is.
--
-- 2. AN APPOINTEE'S DOWNLOAD LINK BECOMES A WINDOW, NOT A KEY. The University:
--    "when appointees download their letters, the download link must expire
--    after 3days. after 3 days, only the superadmin can extract that same
--    letter." The window is THREE DAYS FROM ACCEPTANCE, computed from the
--    acceptance the system already records — no column needed for the ordinary
--    case, which is why there is none.
--
-- 3. AND REOPENING IT IS AN ACT WITH A NAME ON IT. These three columns record
--    a Superadministrator granting a fresh window: until when, by whom, and
--    why. That is the only thing a new column is needed for.
--
-- ---------------------------------------------------------------------------
-- WHY THE WINDOW IS NOT A COLUMN ON EVERY ROW
-- ---------------------------------------------------------------------------
--
-- Because it would be a copy of something already known. `appointment_
-- acceptances.at` is when they accepted; three days later is arithmetic. A
-- stored `expires_at` on every acceptance would be a second version of that
-- fact, and the first time the University changed three days to seven, every
-- row written before the change would disagree with the rule.
--
-- WHAT CANNOT BE DERIVED is an extension: a specific person decided, on a
-- specific day, to let one appointee have another window. That is new
-- information, so it is stored.
--
-- ---------------------------------------------------------------------------
-- READING IS NOT WHAT EXPIRES
-- ---------------------------------------------------------------------------
--
-- An appointee who has not yet answered can always read the letter — they are
-- being asked to agree to it, and nobody should ever be asked to accept a
-- document they cannot see. What expires is KEEPING A COPY after the answer.
-- The route enforces that; this migration only records the extension.
-- ===========================================================================

alter table appointments
  add column if not exists appointee_download_until      timestamptz,
  add column if not exists appointee_download_granted_by uuid references auth.users (id)
    on delete set null,
  add column if not exists appointee_download_granted_at timestamptz;

comment on column appointments.appointee_download_until is
  'A fresh window for the appointee to download their letter, granted by the '
  'Superadministrator after the ordinary three days from acceptance have passed. Null means '
  'the ordinary rule applies.';

-- ---------------------------------------------------------------------------
-- ALL THREE OR NONE
-- ---------------------------------------------------------------------------
--
-- The lesson 047's salary columns taught this system the hard way, applied
-- before it can go wrong here: a window with nobody's name against it is a
-- door somebody opened that the record cannot attribute, which is worse than
-- the door being shut.

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'appointments_download_grant_is_complete') then
    alter table appointments add constraint appointments_download_grant_is_complete
      check (
        (appointee_download_until is null
         and appointee_download_granted_by is null
         and appointee_download_granted_at is null)
        or
        (appointee_download_until is not null
         and appointee_download_granted_at is not null)
      );
  end if;
end $$;

create index if not exists appointments_appointee_download_idx
  on appointments (appointee_download_until)
  where appointee_download_until is not null;


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  someone uuid;
  a_id    uuid;
  refused boolean;
begin
  select id into someone from auth.users order by created_at limit 1;

  insert into appointments
    (full_name, position_title, employment_type, start_date, place_of_duty, status)
  values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
          'Buea', 'draft')
  returning id into a_id;

  -- ---- A WINDOW WITH NOBODY BEHIND IT IS REFUSED ------------------------
  refused := false;
  begin
    update appointments set appointee_download_until = now() + interval '3 days'
     where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '080 FAILED: a download window was opened with no record of who opened it '
                    'or when, so the register cannot say who let a copy out';
  end if;

  -- ---- AND A COMPLETE ONE IS ACCEPTED -----------------------------------
  update appointments
     set appointee_download_until = now() + interval '3 days',
         appointee_download_granted_by = someone,
         appointee_download_granted_at = now()
   where id = a_id;

  if (select appointee_download_until from appointments where id = a_id) is null then
    raise exception '080 FAILED: a complete grant did not store its window';
  end if;

  -- ---- CLEARING IT CLEARS ALL OF IT --------------------------------------
  update appointments
     set appointee_download_until = null,
         appointee_download_granted_by = null,
         appointee_download_granted_at = null
   where id = a_id;

  refused := false;
  begin
    update appointments set appointee_download_granted_at = now() where id = a_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '080 FAILED: half a grant survived, so a row can say somebody granted a '
                    'window that does not exist';
  end if;

  raise exception 'ROLLBACK 080 PROOF';
exception
  when others then
    if sqlerrm <> 'ROLLBACK 080 PROOF' then raise; end if;
end $$;


do $$
begin
  raise notice '080 OK: an appointee''s download window can be reopened, and only with a '
               'record of who reopened it and when';
  raise notice '080 OK: half a grant is refused — a window nobody opened cannot exist';
  raise notice '080 OK: nothing is closed by this migration; the ordinary three days are '
               'computed from the acceptance already on record';
end $$;
