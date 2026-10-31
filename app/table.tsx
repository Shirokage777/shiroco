"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { choose, discardCurrent, drawCard, newGame, playable, reveal, type GameOptions, type GameState } from "@/lib/deck";
import { hazardPeriod } from "@/lib/hazard";
import type { Card } from "@/lib/types";
import { Symbol, SymbolText } from "./symbol-text";
import styles from "./table.module.css";

// The card table: set up a game, then draw. Before a card is triggered only its trigger shows.
// Every button switches to the next note at once, with no animation:
//   draw note --> trigger note --Triggered--> card --Done--> draw note
// and "Not Triggered" goes straight back to the draw note.
export default function Table() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<GameOptions>({ leaveOutMature: false, coop: false });
  const [game, setGame] = useState<GameState | null>(null);
  const [askNewGame, setAskNewGame] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body) => setCards(body.cards))
      .catch(() => setFailed(true));
  }, []);

  // Hazard stripes above the options: the stripe spacing is fitted to the width, so each
  // stripe ends in the same small black triangle at both ends (top right, bottom left).
  useLayoutEffect(() => {
    const options = optionsRef.current;
    if (!game?.revealed || !options) return;
    const fit = () => options.style.setProperty("--hazard-period", `${hazardPeriod(options.clientWidth)}px`);
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(options);
    return () => watch.disconnect();
  }, [game?.revealed]);

  const change = (step: (g: GameState) => GameState) => setGame((g) => (g ? step(g) : g));

  if (failed) return <p className={styles.note}>The cards could not be loaded. Reload the page or sign in again.</p>;
  if (!cards) return <p className={styles.note}>Loading…</p>;

  if (!game) {
    return (
      <div className={styles.pin}>
        <section className={`${styles.setup} ${styles.paper}`}>
          <label>
            <input type="checkbox" checked={options.leaveOutMature} onChange={(e) => setOptions({ ...options, leaveOutMature: e.target.checked })} />
            Leave out mature cards
          </label>
          <label>
            <input type="checkbox" checked={options.coop} onChange={(e) => setOptions({ ...options, coop: e.target.checked })} />
            Co-op game (leave out cards not used in co-op)
          </label>
          <button className={styles.primary} onClick={() => setGame(newGame(cards, options))}>
            Start game · {playable(cards, options).length} cards
          </button>
        </section>
      </div>
    );
  }

  const card = game.current;
  return (
    <section className={styles.table}>
      <header className={styles.status}>
        <span>{game.draw.length} in deck · {game.discard.length} discarded</span>
        {!askNewGame && (
          <button className={styles.secondary} onClick={() => setAskNewGame(true)}>
            New game
          </button>
        )}
      </header>

      {/* Asked on the page, not with a browser pop-up: some browsers block or auto-cancel pop-ups. */}
      {askNewGame && (
        <div className={styles.pin}>
          <div className={`${styles.ask} ${styles.paper}`} role="alertdialog" aria-label="Start a new game?">
            <span>Start a new game? The deck will be reshuffled.</span>
            <button className={styles.primary} onClick={() => { setAskNewGame(false); setGame(null); }}>Yes, new game</button>
            <button className={`${styles.secondary} ${styles.cancel}`} onClick={() => setAskNewGame(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!card && (
        <div className={styles.pin}>
          <div className={`${styles.drawNote} ${styles.paper}`}>
            <button className={styles.primary} onClick={() => change(drawCard)}>
              Draw card
            </button>
          </div>
        </div>
      )}

      {card && (
        <div className={styles.pin}>
          <article
            key={game.revealed ? "open" : "folded"}
            className={`${styles.card} ${styles.paper}`}
            aria-live="polite"
          >
            {/* The corner marks of the real card: mature and not used in co-op. */}
            {(card.mature || card.noCoop) && (
              <div className={styles.marks}>
                {card.mature && <Symbol name="mature" className={styles.mark} />}
                {card.noCoop && <Symbol name="no-coop" className={styles.mark} />}
              </div>
            )}
            {game.revealed && <h2>{card.title}</h2>}
            <p className={styles.trigger}><SymbolText text={card.trigger} /></p>

            {!game.revealed && (
              <div className={styles.actions}>
                <button className={styles.primary} onClick={() => change(reveal)}>Triggered</button>
                <button className={styles.quiet} onClick={() => change(discardCurrent)}>Not Triggered</button>
              </div>
            )}

            {game.revealed && (
              <>
                <p><SymbolText text={card.text} /></p>
                <div ref={optionsRef} className={styles.options}>
                  {card.options.map((option, i) => (
                    <Fragment key={i}>
                    {/* A black hazard stripe (the top bar's pattern, yellow left out) marks each option. */}
                    <div className={styles.hazardRule} aria-hidden="true" />
                    <button
                      className={game.chosen === null ? styles.option : game.chosen === i ? styles.chosen : styles.dimmed}
                      onClick={() => setGame(choose(game, i))}
                      aria-pressed={game.chosen === i}
                    >
                      <strong>{option.label}</strong>
                      <span><SymbolText text={option.text} /></span>
                    </button>
                    </Fragment>
                  ))}
                </div>
                {/* Always laid out, hidden until an option is chosen: the card keeps its size, so
                    Safari never has to redraw the torn paper when Done appears. */}
                <div className={game.chosen === null ? styles.waiting : styles.finish} aria-hidden={game.chosen === null}>
                  <p className={styles.hint}>Changed your mind? Tap your choice again to undo it, or pick another option.</p>
                  <button className={styles.primary} onClick={() => change(discardCurrent)} disabled={game.chosen === null}>Done</button>
                </div>
              </>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
