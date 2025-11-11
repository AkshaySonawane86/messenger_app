// lightweight snapshot helper to read Zustand store outside React hooks
import { create } from "zustand";

let _store;
export default function getAuth() {
  if (!_store) {
    _store = create(() => ({}));
    // will be replaced by actual store via import in useAuthStore
  }
  // if real store has been created, use it
  try {
    const actual = require("./useAuthStore").default;
    return actual.getState();
  } catch (e) {
    return _store.getState();
  }
}
