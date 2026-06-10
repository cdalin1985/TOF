-- Seed Top of the Falls 117-player roster.
-- Source: Carl Higgins Facebook screenshot list recovered from Hermes composer images.
-- Re-runnable for this clean TOF customer project: player names are unique in
-- this roster and rankings/stats upsert against existing constraints.

create unique index if not exists players_full_name_unique
  on public.players (full_name);

with roster(position, full_name) as (
  values
    (1, 'Jerrod Korst'),
    (2, 'Roger Kriedeman'),
    (3, 'Carl Higgins'),
    (4, 'Wade Thompson'),
    (5, 'Ron DeWitt'),
    (6, 'Will Goodwin'),
    (7, 'John Servoss'),
    (8, 'Patrick Murphy'),
    (9, 'Chad Hovland'),
    (10, 'Brittany Korst'),
    (11, 'John Bede'),
    (12, 'Robert Musekamp'),
    (13, 'Dan Patton'),
    (14, 'Jason Riphenburg'),
    (15, 'Owen Tomlinson'),
    (16, 'Jerry Schuler'),
    (17, 'Edin Smith'),
    (18, 'Chuck Stelzer'),
    (19, 'Joel Miller'),
    (20, 'God’King Deezie Ratcliff'),
    (21, 'Kelton Roberts'),
    (22, 'Kevin Burnett'),
    (23, 'Trace Marney'),
    (24, 'Matt Dalla Mura'),
    (25, 'Stuart Paterson'),
    (26, 'Mark O’loughlin'),
    (27, 'Tel McWilliams'),
    (28, 'David Korst'),
    (29, 'Nate Beebe'),
    (30, 'Cody Lattin'),
    (31, 'Mike Birkoski'),
    (32, 'Brian D. Lundquist'),
    (33, 'Jack Barnes'),
    (34, 'Nicole Tomlinson Lundquist'),
    (35, 'Brice Courtnage'),
    (36, 'Dan Rayl'),
    (37, 'Roger Kness'),
    (38, 'Jan Nicola-Higgins'),
    (39, 'Greg Bushman'),
    (40, 'Kevin Kofod'),
    (41, 'Samantha Henderson'),
    (42, 'Steve Patrick'),
    (43, 'Katherine Block'),
    (44, 'Mark Hegel'),
    (45, 'Barry Munns'),
    (46, 'Stephanie Thompson'),
    (47, 'Michael Trotchie'),
    (48, 'Austin Nelson'),
    (49, 'Beau Johnson'),
    (50, 'Devin Gray'),
    (51, 'Mark Farris'),
    (52, 'Dusty Barnes'),
    (53, 'John Barnes'),
    (54, 'Jody Dyson'),
    (55, 'Mike Hilliard'),
    (56, 'Shawn Brass'),
    (57, 'Landon Smith'),
    (58, 'Tyler Warnick'),
    (59, 'Krystal Moen'),
    (60, 'Lloyd Keels'),
    (61, 'Johnny Hill'),
    (62, 'Curt Moore'),
    (63, 'Tyler Sasek'),
    (64, 'Dawna Kraus'),
    (65, 'Kayla Leighann Norris'),
    (66, 'Tyler Coburn'),
    (67, 'Kristi Farris'),
    (68, 'Kory Trash Panda Boots'),
    (69, 'Kurt Mueller'),
    (70, 'Jennifer LaPlante Allan'),
    (71, 'John M Johnson'),
    (72, 'John Jay Mann'),
    (73, 'Curtis G. Thompson'),
    (74, 'Dustin Iszler'),
    (75, 'Justin Burnham'),
    (76, 'Drayke Anthony Holefelder'),
    (77, 'Andrew Schur'),
    (78, 'Katrina Adkins'),
    (79, 'Don Marney'),
    (80, 'Greg Schoby'),
    (81, 'Cassidy P. Knapstad'),
    (82, 'Russell Flanigan'),
    (83, 'Patty Kness'),
    (84, 'Nathaniel McCann'),
    (85, 'Bryan Vaden'),
    (86, 'Gary Skunkcap'),
    (87, 'Linda Ballew'),
    (88, 'Tyler Korst'),
    (89, 'Dylan Riphenburg'),
    (90, 'Ricky Sauvé'),
    (91, 'Kevin Mock'),
    (92, 'Chas Trueman'),
    (93, 'Bradley Horton'),
    (94, 'Carp Mazing'),
    (95, 'Nikki Guckeen'),
    (96, 'Airn Houle'),
    (97, 'Michael Stanley'),
    (98, 'Casey Hall'),
    (99, 'Cary Allan'),
    (100, 'Kevin Pfleger'),
    (101, 'Brad VanSteenvoort'),
    (102, 'Trena Gladeau'),
    (103, 'Josh Micheletti'),
    (104, 'Michael Krebs'),
    (105, 'Nicky Wibbenmeyer'),
    (106, 'Jacob Johnson'),
    (107, 'Jeff Pistelak'),
    (108, 'Bob Paranteau'),
    (109, 'Braden Amundson'),
    (110, 'Malaki Hvamstad'),
    (111, 'Donnie Dues'),
    (112, 'Kyrah Heusel'),
    (113, 'Eric Oakland'),
    (114, 'Scott Coble'),
    (115, 'Justin VanAken'),
    (116, 'Tish Schur'),
    (117, 'Richard Sprau')
), upsert_players as (
  insert into public.players (full_name, is_active)
  select full_name, true
  from roster
  on conflict (full_name) do update
    set is_active = true,
        updated_at = now()
  returning id, full_name
), roster_players as (
  -- Data-modifying CTE inserts are not visible through the base table in this
  -- same statement, so join against the upsert RETURNING rows here.
  select r.position, p.id as player_id
  from roster r
  join upsert_players p on p.full_name = r.full_name
)
insert into public.rankings (player_id, position, previous_position)
select player_id, position, position
from roster_players
on conflict (player_id) do update
  set position = excluded.position,
      previous_position = excluded.previous_position,
      updated_at = now();

with roster(full_name) as (
  values
    ('Jerrod Korst'), ('Roger Kriedeman'), ('Carl Higgins'), ('Wade Thompson'), ('Ron DeWitt'),
    ('Will Goodwin'), ('John Servoss'), ('Patrick Murphy'), ('Chad Hovland'), ('Brittany Korst'),
    ('John Bede'), ('Robert Musekamp'), ('Dan Patton'), ('Jason Riphenburg'), ('Owen Tomlinson'),
    ('Jerry Schuler'), ('Edin Smith'), ('Chuck Stelzer'), ('Joel Miller'), ('God’King Deezie Ratcliff'),
    ('Kelton Roberts'), ('Kevin Burnett'), ('Trace Marney'), ('Matt Dalla Mura'), ('Stuart Paterson'),
    ('Mark O’loughlin'), ('Tel McWilliams'), ('David Korst'), ('Nate Beebe'), ('Cody Lattin'),
    ('Mike Birkoski'), ('Brian D. Lundquist'), ('Jack Barnes'), ('Nicole Tomlinson Lundquist'), ('Brice Courtnage'),
    ('Dan Rayl'), ('Roger Kness'), ('Jan Nicola-Higgins'), ('Greg Bushman'), ('Kevin Kofod'),
    ('Samantha Henderson'), ('Steve Patrick'), ('Katherine Block'), ('Mark Hegel'), ('Barry Munns'),
    ('Stephanie Thompson'), ('Michael Trotchie'), ('Austin Nelson'), ('Beau Johnson'), ('Devin Gray'),
    ('Mark Farris'), ('Dusty Barnes'), ('John Barnes'), ('Jody Dyson'), ('Mike Hilliard'),
    ('Shawn Brass'), ('Landon Smith'), ('Tyler Warnick'), ('Krystal Moen'), ('Lloyd Keels'),
    ('Johnny Hill'), ('Curt Moore'), ('Tyler Sasek'), ('Dawna Kraus'), ('Kayla Leighann Norris'),
    ('Tyler Coburn'), ('Kristi Farris'), ('Kory Trash Panda Boots'), ('Kurt Mueller'), ('Jennifer LaPlante Allan'),
    ('John M Johnson'), ('John Jay Mann'), ('Curtis G. Thompson'), ('Dustin Iszler'), ('Justin Burnham'),
    ('Drayke Anthony Holefelder'), ('Andrew Schur'), ('Katrina Adkins'), ('Don Marney'), ('Greg Schoby'),
    ('Cassidy P. Knapstad'), ('Russell Flanigan'), ('Patty Kness'), ('Nathaniel McCann'), ('Bryan Vaden'),
    ('Gary Skunkcap'), ('Linda Ballew'), ('Tyler Korst'), ('Dylan Riphenburg'), ('Ricky Sauvé'),
    ('Kevin Mock'), ('Chas Trueman'), ('Bradley Horton'), ('Carp Mazing'), ('Nikki Guckeen'),
    ('Airn Houle'), ('Michael Stanley'), ('Casey Hall'), ('Cary Allan'), ('Kevin Pfleger'),
    ('Brad VanSteenvoort'), ('Trena Gladeau'), ('Josh Micheletti'), ('Michael Krebs'), ('Nicky Wibbenmeyer'),
    ('Jacob Johnson'), ('Jeff Pistelak'), ('Bob Paranteau'), ('Braden Amundson'), ('Malaki Hvamstad'),
    ('Donnie Dues'), ('Kyrah Heusel'), ('Eric Oakland'), ('Scott Coble'), ('Justin VanAken'),
    ('Tish Schur'), ('Richard Sprau')
), roster_players as (
  select p.id as player_id
  from roster r
  join public.players p on p.full_name = r.full_name
)
insert into public.player_season_stats (player_id)
select player_id
from roster_players
on conflict (player_id) do nothing;

with roster(full_name) as (
  values
    ('Jerrod Korst'), ('Roger Kriedeman'), ('Carl Higgins'), ('Wade Thompson'), ('Ron DeWitt'),
    ('Will Goodwin'), ('John Servoss'), ('Patrick Murphy'), ('Chad Hovland'), ('Brittany Korst'),
    ('John Bede'), ('Robert Musekamp'), ('Dan Patton'), ('Jason Riphenburg'), ('Owen Tomlinson'),
    ('Jerry Schuler'), ('Edin Smith'), ('Chuck Stelzer'), ('Joel Miller'), ('God’King Deezie Ratcliff'),
    ('Kelton Roberts'), ('Kevin Burnett'), ('Trace Marney'), ('Matt Dalla Mura'), ('Stuart Paterson'),
    ('Mark O’loughlin'), ('Tel McWilliams'), ('David Korst'), ('Nate Beebe'), ('Cody Lattin'),
    ('Mike Birkoski'), ('Brian D. Lundquist'), ('Jack Barnes'), ('Nicole Tomlinson Lundquist'), ('Brice Courtnage'),
    ('Dan Rayl'), ('Roger Kness'), ('Jan Nicola-Higgins'), ('Greg Bushman'), ('Kevin Kofod'),
    ('Samantha Henderson'), ('Steve Patrick'), ('Katherine Block'), ('Mark Hegel'), ('Barry Munns'),
    ('Stephanie Thompson'), ('Michael Trotchie'), ('Austin Nelson'), ('Beau Johnson'), ('Devin Gray'),
    ('Mark Farris'), ('Dusty Barnes'), ('John Barnes'), ('Jody Dyson'), ('Mike Hilliard'),
    ('Shawn Brass'), ('Landon Smith'), ('Tyler Warnick'), ('Krystal Moen'), ('Lloyd Keels'),
    ('Johnny Hill'), ('Curt Moore'), ('Tyler Sasek'), ('Dawna Kraus'), ('Kayla Leighann Norris'),
    ('Tyler Coburn'), ('Kristi Farris'), ('Kory Trash Panda Boots'), ('Kurt Mueller'), ('Jennifer LaPlante Allan'),
    ('John M Johnson'), ('John Jay Mann'), ('Curtis G. Thompson'), ('Dustin Iszler'), ('Justin Burnham'),
    ('Drayke Anthony Holefelder'), ('Andrew Schur'), ('Katrina Adkins'), ('Don Marney'), ('Greg Schoby'),
    ('Cassidy P. Knapstad'), ('Russell Flanigan'), ('Patty Kness'), ('Nathaniel McCann'), ('Bryan Vaden'),
    ('Gary Skunkcap'), ('Linda Ballew'), ('Tyler Korst'), ('Dylan Riphenburg'), ('Ricky Sauvé'),
    ('Kevin Mock'), ('Chas Trueman'), ('Bradley Horton'), ('Carp Mazing'), ('Nikki Guckeen'),
    ('Airn Houle'), ('Michael Stanley'), ('Casey Hall'), ('Cary Allan'), ('Kevin Pfleger'),
    ('Brad VanSteenvoort'), ('Trena Gladeau'), ('Josh Micheletti'), ('Michael Krebs'), ('Nicky Wibbenmeyer'),
    ('Jacob Johnson'), ('Jeff Pistelak'), ('Bob Paranteau'), ('Braden Amundson'), ('Malaki Hvamstad'),
    ('Donnie Dues'), ('Kyrah Heusel'), ('Eric Oakland'), ('Scott Coble'), ('Justin VanAken'),
    ('Tish Schur'), ('Richard Sprau')
), roster_players as (
  select p.id as player_id
  from roster r
  join public.players p on p.full_name = r.full_name
), disciplines(discipline) as (
  values ('8 Ball'), ('9 Ball'), ('10 Ball'), ('Saratoga')
)
insert into public.player_discipline_stats (player_id, discipline)
select rp.player_id, d.discipline
from roster_players rp
cross join disciplines d
on conflict (player_id, discipline) do nothing;

insert into public.audit_events (action, target_type, detail)
values (
  'tof_roster_seeded',
  'league',
  jsonb_build_object('league', 'Top of the Falls', 'player_count', 117, 'source', 'Carl Higgins roster screenshots')
);
