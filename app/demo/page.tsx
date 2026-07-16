import DemoWorld from "./DemoWorld";

export const metadata = { title: "Pulse — live demo" };

/**
 * The sales weapon: a public page that loads the seeded Riverbend demo world
 * instantly. Synthetic data only — the demo hospital is flagged is_demo and
 * exposed through its own RPC.
 */
export default function DemoPage() {
  return <DemoWorld />;
}
