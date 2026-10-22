import { render } from "preact";
import "@fontsource/press-start-2p/cyrillic-400.css";
import "@fontsource/press-start-2p/latin-400.css";
import "@fontsource/tiny5/cyrillic-400.css";
import "@fontsource/tiny5/latin-400.css";
import "./ui/styles.css";
import "./app/settings";
import { App } from "./ui/App";

render(<App />, document.getElementById("app")!);
