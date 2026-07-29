# Project "Hunter" — Initial Project Pitch

I want to make a browser extension that will read a job listing and generate a custom-tailored resume for that position based on my current resume. The project will use AI LLMs to generate the resume in `.docx`, `.md` and `.pdf` formats, being sure that the resume fits comfortably on one page.

## Functional Requirements
- output as `.docx`, `.md`, and `.pdf`
- "one button solution" — clicking the browser extension button is the only required user input
- reads the generic resume from a `.docx` file in the local filesystem and tailors the description to better match the listing
- does not fabricate skills, experiences, roles, or personal projects; it only uses facts that are in the generic resume

## Non-goals
- The project only needs to work on one local machine — no cross-device solutions are needed
- No need to manage resume input or uploads — reading from a set path in the local filesystem is fine
