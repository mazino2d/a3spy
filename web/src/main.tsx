import { render } from "preact";
import { App } from "./app";
// Self-hosted fonts (Vietnamese included), so the installed app needs no third party.
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "./styles.css";

render(<App />, document.getElementById("app") as HTMLElement);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Installing is a convenience; the app works without it.
  });
}
