import styles from "./home.module.css";

export interface LibraryStats {
  circuits: number;
  copies: number;
  makers: number;
  lastSynced?: string;
}

function formatCount(n: number) {
  return n > 0 ? n.toLocaleString("en-US") : "–";
}

/**
 * Library stats laid out like the title block in the corner of a KiCad sheet.
 */
export function TitleBlock({ stats }: { stats: LibraryStats | null }) {
  const loaded = stats !== null;

  return (
    <section
      className={styles.titleBlock}
      aria-label="Library statistics"
      aria-busy={!loaded}
    >
      <div className={`${styles.cell} ${styles.first} ${styles.third}`}>
        <span className={styles.k}>Circuits</span>
        <span className={styles.big}>
          {formatCount(stats?.circuits ?? 0)}
        </span>
      </div>
      <div className={`${styles.cell} ${styles.third}`}>
        <span className={styles.k}>Copies</span>
        <span className={styles.big}>{formatCount(stats?.copies ?? 0)}</span>
      </div>
      <div className={`${styles.cell} ${styles.third}`}>
        <span className={styles.k}>Makers</span>
        <span className={styles.big}>{formatCount(stats?.makers ?? 0)}</span>
      </div>
      <div className={`${styles.cell} ${styles.first} ${styles.wide}`}>
        <span className={styles.k}>Works with</span>
        <span className={styles.v}>KiCad 6.0 and later</span>
      </div>
      <div className={`${styles.cell} ${styles.full}`}>
        <span className={styles.k}>Title</span>
        <span className={styles.titleValue}>
          CircuitSnips, open source under{" "}
          <a
            href="https://github.com/MichaelAyles/kicad-library"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.textLink}
            style={{ fontSize: "inherit" }}
          >
            MIT
          </a>
        </span>
      </div>
    </section>
  );
}
