"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button className="button button-primary noPrint" onClick={() => window.print()} type="button">
      {label}
    </button>
  );
}
