import SignOut from "./sign-out";

// Reached only with a valid session (see middleware.ts). The randomizer comes here next.
export default function Home() {
  return (
    <main>
      <SignOut />
    </main>
  );
}
