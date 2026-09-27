/** Shown while a page's data loads: the same shapes as the page, in quiet gray. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="skeleton">
      <div className="skeletonHeader">
        <span className="skeletonLine skeletonLine-short" />
        <span className="skeletonLine skeletonLine-title" />
        <span className="skeletonLine" />
      </div>
      <div className="skeletonCards">
        <span className="skeletonCard" />
        <span className="skeletonCard" />
        <span className="skeletonCard" />
      </div>
    </div>
  );
}
