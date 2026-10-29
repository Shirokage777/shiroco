"use client";

import { useEffect, useState } from "react";
import { choose, discardCurrent, drawCard, newGame, playable, reveal, type GameOptions, type GameState } from "@/lib/deck";
import type { Card } from "@/lib/types";
import styles from "./table.module.css";

// The card table: set up a game, then draw. Before a card is triggered only its trigger shows.
export default function Table() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<GameOptions>({ leaveOutMature: false, coop: false });
  const [game, setGame] = useState<GameState | null>(null);
  const [askNewGame, setAskNewGame] = useState(false);

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
      <section className={styles.setup}>
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
    );
  }

  const card = game.current;
  return (
    <section className={styles.table}>
      <header className={styles.status}>
        <span>{game.draw.length} in deck · {game.discard.length} discarded</span>
        {!askNewGame && (
          <button className={styles.link} onClick={() => setAskNewGame(true)}>
            New game
          </button>
        )}
      </header>

      {/* Asked on the page, not with a browser pop-up: some browsers block or auto-cancel pop-ups. */}
      {askNewGame && (
        <div className={styles.ask} role="alertdialog" aria-label="Start a new game?">
          <span>Start a new game? The deck is reshuffled.</span>
          <button className={styles.primary} onClick={() => { setAskNewGame(false); setGame(null); }}>Yes, new game</button>
          <button onClick={() => setAskNewGame(false)}>Cancel</button>
        </div>
      )}

      {!card && (
        <button className={styles.primary} onClick={() => setGame(drawCard(game))}>
          Draw card
        </button>
      )}

      {card && (
        <article className={styles.card} aria-live="polite">
          {game.revealed && <h2>{card.title}</h2>}
          <p className={styles.trigger}>{card.trigger}</p>

          {!game.revealed && (
            <div className={styles.actions}>
              <button className={styles.primary} onClick={() => setGame(reveal(game))}>Triggered</button>
              <button onClick={() => setGame(discardCurrent(game))}>Not triggered</button>
            </div>
          )}

          {game.revealed && (
            <>
              <p>{card.text}</p>
              <div className={styles.options}>
                {card.options.map((option, i) => (
                  <button
                    key={i}
                    className={game.chosen === null ? styles.option : game.chosen === i ? styles.chosen : styles.dimmed}
                    onClick={() => setGame(choose(game, i))}
                    disabled={game.chosen !== null}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.text}</span>
                  </button>
                ))}
              </div>
              {game.chosen !== null && (
                <button className={styles.primary} onClick={() => setGame(discardCurrent(game))}>Done</button>
              )}
            </>
          )}
        </article>
      )}
    </section>
  );
}
