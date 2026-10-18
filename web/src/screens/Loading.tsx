import { t } from "../messages";

/** Shown until the first state arrives: the logo and a skeleton of the screen, never a blank page (M8 U10). */
export function Loading() {
  return (
    <main class="screen loading" aria-busy="true">
      <img class="logo" src="/icons/icon-192.png" alt="" width={72} height={72} />
      <p class="muted">{t.connecting}</p>
      <div class="skeleton tall" />
      <div class="skeleton" />
      <div class="skeleton" />
      <div class="skeleton short" />
    </main>
  );
}
