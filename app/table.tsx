"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { choose, discardCurrent, drawCard, newGame, playable, reveal, type GameOptions, type GameState } from "@/lib/deck";
import type { Card } from "@/lib/types";
import { flipOver, turnAway, turnIn } from "./flip";
import { Symbol, SymbolText } from "./symbol-text";
import { unfold } from "./unfold";
import styles from "./table.module.css";

const REFOLD_MS = 1500; // the refold animation (table.module.css)
export const SHRINK_MS = 260; // a question note shrinking back into its button (table.module.css)

const stillWanted = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// The card table: set up a game, then draw. Before a card is triggered only its trigger shows.
//
// Every change of note is a turn of the paper (flip.ts):
//   draw note --turn--> trigger note --flip, unfold--> card --refold, turn--> draw note
// and "Not Triggered" turns the trigger note back to the draw note.
export default function Table() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<GameOptions>({ leaveOutMature: false, coop: false });
  const [game, setGame] = useState<GameState | null>(null);
  const [askNewGame, setAskNewGame] = useState(false);
  const [closingAsk, setClosingAsk] = useState(false);
  const [busy, setBusy] = useState(false); // a turn or refold is running: ignore further taps
  const [refolding, setRefolding] = useState(false);
  const setupRef = useRef<HTMLElement>(null);
  const drawRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLElement>(null);
  const openRef = useRef<HTMLElement>(null);
  const turnInNext = useRef(false);
  const unfoldFrom = useRef(0); // height of the folded note that was just turned over

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body) => setCards(body.cards))
      .catch(() => setFailed(true));
  }, []);

  // The second half of a turn: once React shows the next note, turn it in from edge-on.
  useLayoutEffect(() => {
    if (!turnInNext.current) return;
    const next = game?.current ? noteRef.current : drawRef.current;
    turnInNext.current = false;
    if (next) turnIn(next, () => setBusy(false));
    else setBusy(false);
  }, [game]);

  // After Triggered: the card unfolds from the size of the note that was turned over.
  useLayoutEffect(() => {
    if (!unfoldFrom.current || !game?.revealed || !openRef.current) return;
    unfold(openRef.current, unfoldFrom.current, styles.flap);
    unfoldFrom.current = 0;
  }, [game?.revealed]);

  // Turns `note` away, then changes the game; the next note turns in (effect above).
  function turnTo(note: HTMLElement | null, change: (g: GameState) => GameState) {
    if (busy) return;
    if (!note || stillWanted()) return setGame((g) => (g ? change(g) : g));
    setBusy(true);
    turnAway(note, () => {
      turnInNext.current = true;
      setGame((g) => (g ? change(g) : g));
    });
  }

  // Start game: the setup note turns over into the draw note.
  function startGame() {
    if (busy || !cards) return;
    const setup = setupRef.current;
    if (!setup || stillWanted()) return setGame(newGame(cards, options));
    setBusy(true);
    turnAway(setup, () => {
      turnInNext.current = true;
      setGame(newGame(cards, options));
    });
  }

  // Either answer to "New game?" first shrinks the note back into the button it came from.
  function closeAsk(then?: () => void) {
    const finish = () => {
      setClosingAsk(false);
      setAskNewGame(false);
      then?.();
    };
    if (stillWanted()) return finish();
    setClosingAsk(true);
    window.setTimeout(finish, SHRINK_MS);
  }

  // Triggered: the folded note is turned over, bending as it goes, then it unfolds (unfold.ts).
  function trigger() {
    if (busy) return;
    if (!noteRef.current || stillWanted()) return setGame((g) => (g ? reveal(g) : g));
    setBusy(true);
    unfoldFrom.current = noteRef.current.offsetHeight;
    flipOver(noteRef.current, styles.paper, () => {
      setGame((g) => (g ? reveal(g) : g));
      setBusy(false);
    });
  }

  // Done: the card folds itself back up, the small packet is turned over, the draw note returns.
  function done() {
    const open = openRef.current;
    if (busy) return;
    if (!open || stillWanted()) return setGame((g) => (g ? discardCurrent(g) : g));
    setBusy(true);
    setRefolding(true);
    window.setTimeout(() => {
      // Stand-in for the folded packet (blank paper side up), so the turn has one plain sheet.
      const packet = document.createElement("div");
      packet.className = styles.paper;
      Object.assign(packet.style, {
        position: "absolute",
        left: `${open.offsetLeft}px`,
        top: `${open.offsetTop}px`,
        width: `${open.offsetWidth}px`,
        height: `${open.offsetHeight / 8}px`,
      });
      open.parentElement?.append(packet);
      open.parentElement?.classList.add(styles.folded);
      turnAway(packet, () => {
        packet.remove();
        turnInNext.current = true;
        setRefolding(false);
        setGame((g) => (g ? discardCurrent(g) : g));
      });
    }, REFOLD_MS);
  }

  if (failed) return <p className={styles.note}>The cards could not be loaded. Reload the page or sign in again.</p>;
  if (!cards) return <p className={styles.note}>Loading…</p>;

  if (!game) {
    return (
      <div className={styles.pin}>
        <section ref={setupRef} className={`${styles.setup} ${styles.paper}`}>
          <label>
            <input type="checkbox" checked={options.leaveOutMature} onChange={(e) => setOptions({ ...options, leaveOutMature: e.target.checked })} />
            Leave out mature cards
          </label>
          <label>
            <input type="checkbox" checked={options.coop} onChange={(e) => setOptions({ ...options, coop: e.target.checked })} />
            Co-op game (leave out cards not used in co-op)
          </label>
          <button className={styles.primary} onClick={startGame}>
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
        <div className={`${styles.pin} ${closingAsk ? styles.shrinkToTopRight : styles.growFromTopRight}`}>
          <div className={`${styles.ask} ${styles.paper}`} role="alertdialog" aria-label="Start a new game?">
            <span>Start a new game? The deck will be reshuffled.</span>
            <button className={styles.primary} onClick={() => closeAsk(() => setGame(null))}>Yes, new game</button>
            <button className={styles.secondary} onClick={() => closeAsk()}>Cancel</button>
          </div>
        </div>
      )}

      {!card && (
        <div className={`${styles.pin}`}>
          <div ref={drawRef} className={`${styles.drawNote} ${styles.paper}`}>
            <button className={styles.primary} onClick={() => turnTo(drawRef.current, drawCard)}>
              Draw card
            </button>
          </div>
        </div>
      )}

      {card && (
        <div className={`${styles.pin} ${refolding ? styles.refolding : ""}`}>
          {/* Triggered: the card unfolds from the folded note's size (unfold.ts).
              Done: these flaps fold it back up to 1/8, step by step (CSS .refolding). */}
          {game.revealed && (
            <>
              <div className={`${styles.flap} ${styles.flap1}`} aria-hidden="true" />
              <div className={`${styles.flap} ${styles.flap2}`} aria-hidden="true" />
              <div className={`${styles.flap} ${styles.flap3}`} aria-hidden="true" />
            </>
          )}
          <article
            key={game.revealed ? "open" : "folded"}
            ref={game.revealed ? openRef : noteRef}
            className={`${styles.card} ${styles.paper} ${refolding ? styles.refold : ""}`}
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
                <button className={styles.quiet} onClick={() => turnTo(noteRef.current, discardCurrent)}>Not Triggered</button>
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
                    <button className={styles.primary} onClick={done}>Done</button>
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
