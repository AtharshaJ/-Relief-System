--drop the existing foreign key constraint--
ALTER TABLE absences DROP CONSTRAINT absences_teacher_id_fkey;

--drop the existing primary key on teachers--
ALTER TABLE teachers DROP CONSTRAINT teachers_pkey;

--ensure tr_id is unique and not null--
ALTER TABLE teachers ALTER COLUMN tr_id SET NOT NULL;
ALTER TABLE teachers ADD CONSTRAINT teachers_tr_id_unique UNIQUE (tr_id);

--make tr_id new primary key of the teachers--
ALTER TABLE teachers ADD PRIMARY KEY (tr_id);

--make abseces.teacher_id type to match tr_id type
ALTER TABLE absences ALTER COLUMN teacher_id TYPE VARCHAR(100) 
USING teacher_id::VARCHAR(100);

--recreate forignkey pointing to tr_id
ALTER TABLE absences 
  ADD CONSTRAINT absences_teacher_id_fkey 
  FOREIGN KEY (teacher_id) REFERENCES teachers(tr_id);