import type { Application, GameWorld, Letter, RewardGrant, WorkerHistory } from "@paw-time/api-contracts";
import { Avatar } from "@/components/Avatar";
import { createFormatters } from "@/lib/format";
import { fill, type Locale, type Messages } from "@/lib/i18n/messages";
import { employerRewardEvents, islandCatalog, islandProgress, islandResident } from "@/lib/island";
import { islandItemLabel } from "@/lib/labels";

type IslandDetailsProps = {
  world: GameWorld;
  rewards: RewardGrant[];
  regulars: WorkerHistory[];
  letters: Letter[];
  applications: Application[];
  now: Date;
  m: Messages;
  locale: Locale;
};

export function IslandDetails({ world, rewards, regulars, letters, applications, now, m, locale }: IslandDetailsProps) {
  const { formatElapsed, formatDate } = createFormatters(locale);
  const replies = letters
    .filter((letter) => letter.replyStamp !== null)
    .sort((left, right) => Date.parse(right.repliedAt ?? "") - Date.parse(left.repliedAt ?? ""));
  const workerName = (workerId: string) =>
    applications.find((application) => application.workerId === workerId)?.workerDisplayName ?? m.attendance.fallbackWorker;
  const progress = islandProgress(world);
  const nextUnlock = progress.nextLevel?.unlocks[0];
  return (
    <>
      <section className="panel nightPanel pointsPanel">
        <div aria-hidden="true" className="starfield" />
        <div className="pointsMain">
          <p className="eyebrow eyebrow-gold">{m.island.pointsEyebrow}</p>
          <h2>
            {fill(m.island.level, { level: progress.level })}
            <small>{fill(m.island.xp, { xp: progress.experience })}</small>
          </h2>
          <div
            aria-label={m.island.progressLabel}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress.percent}
            className="progress"
            role="progressbar"
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p>
            {progress.nextLevel && nextUnlock
              ? fill(m.island.remaining, {
                  xp: progress.remaining,
                  level: progress.nextLevel.level,
                  item: islandItemLabel(nextUnlock, m),
                })
              : m.island.complete}
          </p>
          <p className="hint">{m.island.pointsHint}</p>
        </div>
        {nextUnlock ? (
          <img alt="" className="silhouette" height={120} src={`/obake/${islandResident[nextUnlock] ?? "nemurin"}.webp`} width={120} />
        ) : null}
      </section>
      <section className="islandSection">
        <p className="eyebrow">{m.island.unlocksEyebrow}</p>
        <h2>{m.island.unlocksTitle}</h2>
        <ol className="unlockGrid">
          {islandCatalog.levels.map((entry) => {
            const unlocked = world.experience >= entry.requiredExperience;
            const item = entry.unlocks[0] ?? "";
            return (
              <li className={unlocked ? "unlockCard" : "unlockCard unlockCard-locked"} key={entry.level}>
                <img alt="" height={150} src={`/obake/${islandResident[item] ?? "nemurin"}.webp`} width={150} />
                <span className="unlockLevel">{fill(m.island.level, { level: entry.level })}</span>
                <h3>{unlocked ? islandItemLabel(item, m) : m.island.hidden}</h3>
                <small>{unlocked ? m.island.unlocked : fill(m.island.locked, { xp: entry.requiredExperience })}</small>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="islandDetails">
        <section className="panel">
          <p className="eyebrow">{m.island.regularsEyebrow}</p>
          <h2>{m.island.regularsTitle}</h2>
          {regulars.length === 0 ? (
            <p>{m.island.regularsEmpty}</p>
          ) : (
            <ul className="regularList" role="list">
              {regulars.map((history) => (
                <li key={history.workerId}>
                  <Avatar name={history.displayName} seed={history.workerId} />
                  <div>
                    <strong>{history.displayName}</strong>
                    <small>
                      {fill(m.island.regularsCount, { count: history.completedShifts })}
                      {history.lastWorkedAt ? ` ・ ${formatDate(history.lastWorkedAt)}` : ""}
                    </small>
                  </div>
                  {history.averageRating !== null ? <span className="stars starsSmall">{"★".repeat(Math.round(history.averageRating))}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel mailbox">
          <p className="eyebrow">{m.island.mailboxEyebrow}</p>
          <h2>{m.island.mailboxTitle}</h2>
          {replies.length === 0 ? (
            <p>{m.island.mailboxEmpty}</p>
          ) : (
            <ul className="mailList" role="list">
              {replies.slice(0, 6).map((letter) => (
                <li key={letter.id}>
                  <img alt="" height={36} src="/obake/morattan.webp" width={36} />
                  <span>
                    {fill(m.island.mailboxLine, {
                      name: workerName(letter.workerId),
                      stamp: m.labels.stamp[letter.replyStamp ?? "thanks"],
                    })}
                    <small>{letter.repliedAt ? formatElapsed(letter.repliedAt, now) : ""}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="islandDetails">
        <section className="panel">
          <p className="eyebrow">{m.island.logEyebrow}</p>
          <h2>{m.island.logTitle}</h2>
          {rewards.length === 0 ? (
            <p>{m.island.logEmpty}</p>
          ) : (
            <ul className="rewardFeed">
              {rewards.slice(0, 8).map((reward) => (
                <li key={reward.id}>
                  <span>{m.labels.reward[reward.rewardCode]}</span>
                  <strong>{fill(m.common.xp, { xp: reward.experience })}</strong>
                  <small>{formatElapsed(reward.grantedAt, now)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel nightPanel">
          <div aria-hidden="true" className="starfield" />
          <p className="eyebrow eyebrow-gold">{m.island.howEyebrow}</p>
          <h2>{m.island.howTitle}</h2>
          <ul className="rewardFeed">
            {employerRewardEvents.map((event) => (
              <li key={event.code}>
                <span>{m.labels.reward[event.code]}</span>
                <strong>{fill(m.common.xp, { xp: event.experience })}</strong>
              </li>
            ))}
          </ul>
          <p className="hint">{m.island.howHint}</p>
        </section>
      </div>
    </>
  );
}
