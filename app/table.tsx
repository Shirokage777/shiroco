"use client";

import { useEffect, useRef, useState } from "react";
import { choose, discardCurrent, drawCard, newGame, playable, reveal, type GameOptions, type GameState } from "@/lib/deck";
import type { Card } from "@/lib/types";
import { flipOver } from "./flip";
import { Symbol, SymbolText } from "./symbol-text";
import styles from "./table.module.css";

// The card table: set up a game, then draw. Before a card is triggered only its trigger shows.
export default function Table() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<GameOptions>({ leaveOutMature: false, coop: false });
  const [game, setGame] = useState<GameState | null>(null);
  const [askNewGame, setAskNewGame] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const noteRef = useRef<HTMLElement>(null);

  // Triggered: the folded note is first turned over, bending as it goes (flip.ts), then it unfolds (CSS).
  function trigger() {
    const showCard = () => setGame((g) => (g ? reveal(g) : g));
    if (flipping) return;
    if (!noteRef.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return showCard();
    setFlipping(true);
    flipOver(noteRef.current, styles.paper, () => {
      showCard();
      setFlipping(false);
    });
  }

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body) => setCards(body.cards))
      .catch(() => setFailed(true));
  }, []);

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
            <button className={styles.secondary} onClick={() => setAskNewGame(false)}>Cancel</button>
          </div>
        </div>
      )}

      {!card && (
        <button className={styles.primary} onClick={() => setGame(drawCard(game))}>
          Draw card
        </button>
      )}

      {card && (
        <div className={`${styles.pin} ${styles.clipped}`}>
        {/* When triggered, the note unfolds three times (1/8 → 1/4 → 1/2 → full):
            the card is revealed step by step while a paper flap swings down at each fold. */}
        {game.revealed && (
          <>
            <div className={`${styles.flap} ${styles.flap1}`} aria-hidden="true" />
            <div className={`${styles.flap} ${styles.flap2}`} aria-hidden="true" />
            <div className={`${styles.flap} ${styles.flap3}`} aria-hidden="true" />
          </>
        )}
        <article
          key={game.revealed ? "open" : "folded"}
          ref={game.revealed ? undefined : noteRef}
          className={`${styles.card} ${styles.paper} ${game.revealed ? styles.unfold : ""}`}
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
              <button className={styles.primary} onClick={trigger}>Triggered</button>
              <button className={styles.quiet} onClick={() => setGame(discardCurrent(game))}>Not Triggered</button>
            </div>
          )}

          {game.revealed && (
            <>
              <p><SymbolText text={card.text} /></p>
              <div className={styles.options}>
                {card.options.map((option, i) => (
                  <button
                    key={i}
                    className={game.chosen === null ? styles.option : game.chosen === i ? styles.chosen : styles.dimmed}
                    onClick={() => setGame(choose(game, i))}
                    aria-pressed={game.chosen === i}
                  >
                    <strong>{option.label}</strong>
                    <span><SymbolText text={option.text} /></span>
                  </button>
                ))}
              </div>
              {game.chosen !== null && (
                <>
                  <p className={styles.hint}>Changed your mind? Tap your choice again to undo it, or pick another option.</p>
                  <button className={styles.primary} onClick={() => setGame(discardCurrent(game))}>Done</button>
                </>
              )}
            </>
          )}
        </article>
        </div>
      )}
    </section>
  );
}
