# Teacher Mode

Teacher Mode provides six original activities with 45- and 90-minute variants. The workflow is: select activity → create four-hour code → learners join with pseudonyms → submit reasoning → discuss aggregate distribution/process → export aggregate CSV → close.

Teacher accounts require `app_metadata.borza_role` set to `teacher` or `admin` by a trusted administrator. Self-editable `user_metadata` is never accepted as authorization. Teacher accounts own sessions and dashboards; learners receive `403`, while a different teacher receives `404`, not metadata. The raw class code is returned once and never recoverable from the database. Student answers are evaluated from canonical content; clients cannot award their own scores. CSV contains metrics and distributions, not pseudonyms or response prose.

Materials in `content/academy/teacher/` cover objectives, preparation, prompts, misconceptions, rubric, and extension. Score calculation, assumptions, risk identification, alternatives, and reflection separately. Do not rank wealth, returns, speed, or risk appetite.
