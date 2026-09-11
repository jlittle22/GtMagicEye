import { RequireAuth } from "../../components/RequireAuth";

export default function OverviewPage() {
  return (
    <RequireAuth>
      <main>
        <h1>Overview</h1>
      </main>
    </RequireAuth>
  );
}
