export function LoadingSkeletonPage() {
  return (
    <div className="stack skeletonPage" aria-hidden="true">
      <section className="heroCard skeletonBlock">
        <div className="heroInner">
          <div className="skeletonLine short" />
          <div className="skeletonLine title" />
          <div className="skeletonLine medium" />
          <div className="heroStats">
            <div className="stat skeletonInset">
              <div className="skeletonLine short" />
              <div className="skeletonBar" />
              <div className="skeletonLine tiny" />
            </div>
            <div className="stat skeletonInset">
              <div className="skeletonLine short" />
              <div className="skeletonLine medium" />
              <div className="skeletonLine tiny" />
            </div>
          </div>
        </div>
      </section>

      <section className="panel skeletonBlock">
        <div className="skeletonInput" />
        <div className="skeletonLine medium" />
      </section>

      <section className="panel skeletonBlock">
        <div className="skeletonLine medium" />
        <div className="skeletonGrid">
          <div className="skeletonCard" />
          <div className="skeletonCard" />
          <div className="skeletonCard" />
        </div>
      </section>
    </div>
  )
}
