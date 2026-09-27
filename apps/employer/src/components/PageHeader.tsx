import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  /** An obake from /public/obake that floats beside the title. */
  obake?: string;
};

export function PageHeader({ eyebrow, title, description, action, obake }: PageHeaderProps) {
  return (
    <header className="pageHeader">
      <div className="pageHeaderText">
        {obake ? <img alt="" className="pageObake" height={84} src={`/obake/${obake}.webp`} width={84} /> : null}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {action ? <div className="pageHeaderAction">{action}</div> : null}
    </header>
  );
}
