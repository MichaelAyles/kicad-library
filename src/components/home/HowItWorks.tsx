import styles from "./home.module.css";

function Keys({ keys }: { keys: string[] }) {
  return (
    <>
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && " "}
          <kbd className={styles.kbd}>{k}</kbd>
        </span>
      ))}
    </>
  );
}

export function HowItWorks() {
  return (
    <section className={styles.section} aria-labelledby="how-heading">
      <div className="container mx-auto px-4">
        <h2 id="how-heading" className={styles.h2}>
          How copying into KiCad works
        </h2>
        <p className={styles.intro}>
          KiCad copies a selection as plain text. CircuitSnips stores that text
          and gives it back, so a circuit moves between projects in three steps.
        </p>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNo}>Step 1</span>
            <h3>Copy from your schematic</h3>
            <p>
              Select the parts and wires in Eeschema and press{" "}
              <Keys keys={["Ctrl", "C"]} />. KiCad puts them on your clipboard.
            </p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNo}>Step 2</span>
            <h3>Publish it</h3>
            <p>
              Paste into the Upload page, then add a title, tags and a license.
              The preview renders straight away and the circuit becomes
              searchable.
            </p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNo}>Step 3</span>
            <h3>Paste it into a project</h3>
            <p>
              Anyone can press Copy on a circuit page, then{" "}
              <Keys keys={["Ctrl", "V"]} /> in Eeschema. Symbols, values and
              wiring arrive as they were drawn.
            </p>
          </li>
        </ol>
      </div>
    </section>
  );
}
