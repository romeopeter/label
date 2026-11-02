/**
 * Undo and redo over snapshots of the document. Elements are never mutated, so
 * a snapshot is cheap: it shares everything that didn't change, images included.
 *
 * Every change lands in the store, but one step should mean one action, so
 * changes are grouped. Anything made while the pointer is down is one step (a
 * drag, a resize, a slider), a new press closes the previous step, and changes
 * with no pointer involved (typing, arrow keys) close after a short pause.
 */

const MAX_STEPS = 100;
const PAUSE_MS = 400;

export interface History {
  /** Call when the document changes. */
  changed: () => void;
  /** Runs a change that isn't the user's doing, such as re-measuring text. */
  silently: (change: () => void) => void;
  undo: () => void;
  redo: () => void;
  /** Starts over, for when a different document is loaded. */
  reset: () => void;
}

export const createHistory = <Doc>({
  read,
  write,
  onStacksChange,
}: {
  read: () => Doc;
  write: (doc: Doc) => void;
  onStacksChange: (canUndo: boolean, canRedo: boolean) => void;
}): History => {
  let past: Doc[] = [];
  let future: Doc[] = [];
  let baseline = read();
  let dirty = false;
  let pointerDown = false;
  let ignoring = false;
  let silent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const notify = () => onStacksChange(past.length > 0, future.length > 0);

  const closeStep = () => {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    past = [...past.slice(-(MAX_STEPS - 1)), baseline];
    future = [];
    baseline = read();
    notify();
  };

  const move = (from: Doc[], to: Doc[]) => {
    const doc = from[from.length - 1];
    if (doc === undefined) return null;
    to.push(baseline);
    from.pop();
    baseline = doc;
    ignoring = true;
    write(doc);
    ignoring = false;
    notify();
    return doc;
  };

  window.addEventListener(
    "pointerdown",
    () => {
      closeStep();
      pointerDown = true;
    },
    true,
  );
  window.addEventListener("pointerup", () => {
    pointerDown = false;
    // After the release's own handlers, which may still be changing things.
    setTimeout(closeStep, 0);
  });

  return {
    changed: () => {
      if (ignoring) return;
      if (silent) {
        if (!dirty) baseline = read();
        return;
      }
      dirty = true;
      clearTimeout(timer);
      if (!pointerDown) timer = setTimeout(closeStep, PAUSE_MS);
    },
    silently: (change) => {
      silent = true;
      change();
      silent = false;
    },
    undo: () => {
      closeStep();
      move(past, future);
    },
    redo: () => {
      closeStep();
      move(future, past);
    },
    reset: () => {
      clearTimeout(timer);
      past = [];
      future = [];
      dirty = false;
      baseline = read();
      notify();
    },
  };
};
