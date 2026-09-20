import subprocess, uuid, random
random.seed(7)
first = ["Ada","Grace","Alan","Katherine","Margaret","Linus","Tim","Radia","Barbara","Donald","Edsger","Hedy","Dennis","Ken","Guido","Anita","Sophie","Vint","Bjarne","Yukihiro","Lea","Evan","Sarah","Priya","Rohan","Meera","Arjun","Kavya","Ishaan","Diya"]
last = ["Lovelace","Hopper","Turing","Johnson","Hamilton","Torvalds","Berners-Lee","Perlman","Liskov","Knuth","Dijkstra","Lamarr","Ritchie","Thompson","van Rossum","Borg","Wilson","Cerf","Stroustrup","Matsumoto","Verou","You","Drasner","Sharma","Mehta","Nair","Kapoor","Iyer","Verma","Singh"]
teams = {"core-team":"Core Team","technical":"Technical","design":"Design","community":"Community","operations":"Operations"}
team_ids = {s: str(uuid.uuid4()) for s in teams}
sql = ["insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000a1','admin@example.test'),('00000000-0000-0000-0000-0000000000b2','plain@example.test');",
       "insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1');"]
for s,n in teams.items():
    sql.append(f"insert into public.teams (id,name,slug) values ('{team_ids[s]}','{n}','{s}');")
sql.append(f"insert into public.teams (name,slug,is_active) values ('Retired Crew','retired-crew',false);")
slugs = list(teams)
ids=[]
for i,(f,l) in enumerate(zip(first,last)):
    vid = str(uuid.uuid4()); ids.append(vid)
    name = f"{f} {l}"
    slug = (f"{f}-{l}").lower().replace(" ","-")
    team = team_ids[slugs[i % len(slugs)]]
    photo = f"'{vid}/{uuid.uuid4()}.png'" if i == 0 else "null"
    social = '{"github": {"url": "https://github.com/ada", "approved": true}, "instagram": {"url": "https://www.instagram.com/hidden-ada", "approved": false}}' if i == 0 else '{}'
    bio = "Wrote the first program. Loves analytical engines and workshops." if i == 0 else ""
    skills = "array['Maths','Writing']" if i == 0 else "'{}'"
    sql.append(f"insert into public.volunteers (id,full_name,slug,team_id,public_role,bio,photo_path,skills,social_links,is_published,consent_status,consent_recorded_at,consent_version) values ('{vid}','{name}','{slug}','{team}','Volunteer','{bio}',{photo},{skills},'{social}'::jsonb,true,'granted',now(),'seed');")
    if i == 0:
        sql.append(f"insert into storage.objects (bucket_id,name) select 'volunteer-photos', photo_path from public.volunteers where id='{vid}';")
# One unpublished volunteer with a photo, one pending consent
uid = str(uuid.uuid4())
sql.append(f"insert into public.volunteers (id,full_name,slug,team_id,public_role,photo_path,is_published,consent_status,consent_recorded_at,consent_version) values ('{uid}','Hidden Person','hidden-person','{team_ids['design']}','Draft','{uid}/{uuid.uuid4()}.png',false,'granted',now(),'seed');")
sql.append(f"insert into storage.objects (bucket_id,name) select 'volunteer-photos', photo_path from public.volunteers where id='{uid}';")
sql.append(f"insert into public.volunteers (full_name,slug,team_id,is_published,consent_status) values ('Pending Person','pending-person','{team_ids['design']}',false,'pending');")
open("tests/e2e-local/fixtures.sql","w").write("\n".join(sql))
print("fixtures written", len(sql), "statements")
