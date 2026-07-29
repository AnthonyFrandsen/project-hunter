import { createApp } from "./app";

const PORT = 10105;

createApp().listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
});
