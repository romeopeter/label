import { cn } from "@/lib/utils";

/** Screens and browsers are drawn to fit their picture, so they have no artwork to show here. */

const Picture = ({ className }: { className?: string }) => (
  <div className={cn("flex-1 rounded-[1px] bg-p-700", className)} />
);

const SCREEN_THUMB: Record<string, string> = {
  plain: "",
  "glass-light": "border border-text/40 bg-text/20 p-1",
  "glass-dark": "border border-text/20 bg-chrome p-1",
  liquid: "border border-text bg-text/15 p-1",
  "inset-light": "border border-hairline-strong bg-text/70 p-1.5",
  "inset-dark": "border border-hairline-strong bg-chrome p-1.5",
  outline: "border border-text p-1",
  border: "bg-text p-0.5",
};

const Sheet = ({ className }: { className: string }) => (
  <div className={cn("absolute rounded-sm border border-hairline-strong", className)} />
);

export const ScreenThumb = ({ id }: { id: string }) => {
  if (id === "retro") {
    return (
      <div className="flex h-full w-full flex-col rounded-sm bg-text-muted pb-1">
        <div className="flex flex-1 rounded-sm bg-text p-0.5">
          <Picture />
        </div>
      </div>
    );
  }
  if (id === "card") {
    return (
      <div className="relative h-full w-full">
        <Sheet className="inset-0.5 rotate-3 bg-text-muted" />
        <div className="absolute inset-0.5 flex rounded-sm bg-text p-1">
          <Picture />
        </div>
      </div>
    );
  }
  if (id === "stack") {
    return (
      <div className="relative h-full w-full">
        <Sheet className="inset-x-1.5 bottom-0 h-1/2 bg-text-faint" />
        <Sheet className="inset-x-0.5 bottom-0.5 h-1/2 bg-text-muted" />
        <div className="absolute inset-x-0 bottom-1 top-0 flex overflow-hidden rounded-sm">
          <Picture />
        </div>
      </div>
    );
  }
  if (id === "stack-2") {
    return (
      <div className="relative h-full w-full">
        <Sheet className="bottom-1.5 left-0 right-1.5 top-0 bg-text-faint" />
        <Sheet className="bottom-0.75 left-0.75 right-0.75 top-0.75 bg-text-muted" />
        <div className="absolute bottom-0 left-1.5 right-0 top-1.5 flex overflow-hidden rounded-sm">
          <Picture />
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex h-full w-full rounded-sm", SCREEN_THUMB[id])}>
      <Picture />
    </div>
  );
};

const Field = ({ className }: { className?: string }) => (
  <span className={cn("h-0.5 flex-1 rounded-full bg-text-muted", className)} />
);

const TopRow = ({ dots }: { dots?: boolean }) => (
  <div className="flex h-1.5 shrink-0 items-center gap-px bg-hairline-strong px-0.5">
    {dots && (
      <>
        <span className="h-0.5 w-0.5 rounded-full bg-text-muted" />
        <span className="h-0.5 w-0.5 rounded-full bg-text-muted" />
      </>
    )}
    <Field />
  </div>
);

const TabRow = ({ tab }: { tab: string }) => (
  <div className="flex h-1.5 shrink-0 items-end gap-px bg-hairline-strong px-0.5">
    <span className={cn("h-1 w-1/3 bg-text-muted", tab)} />
  </div>
);

const THUMB_TAB: Record<string, string> = {
  chrome: "rounded-t-sm",
  brave: "rounded-t-sm",
  edge: "mb-px rounded-[1px]",
  firefox: "mb-px rounded-full",
};

export const BrowserThumb = ({ id }: { id: string }) => {
  const [family, size] = id.split("-");
  const shape = size === "mobile" ? "w-1/2" : size === "tablet" ? "w-3/4" : "w-full";
  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-sm border border-hairline-strong", shape)}>
      {family === "safari" ? <TopRow dots={!size} /> : size === "mobile" ? <TopRow /> : <TabRow tab={THUMB_TAB[family]} />}
      {family !== "safari" && size !== "mobile" && <TopRow />}
      <Picture className="rounded-none" />
      {family === "safari" && size === "mobile" && <TopRow />}
    </div>
  );
};
