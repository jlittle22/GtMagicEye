const os = require("os");

// WSL2's `localhost` port-forwarding relay is unreliable, especially after
// repeated bind/kill cycles on a port. Point dev URLs at the WSL2 VM's actual
// IP instead, so Windows-side browsers/Postman connect directly. This is
// recomputed on every build since the IP changes on WSL restart.
function getWslIp() {
  const eth0 = os.networkInterfaces().eth0 || [];
  const ipv4 = eth0.find((addr) => addr.family === "IPv4" && !addr.internal);
  return ipv4 ? ipv4.address : "localhost";
}

const devHost = getWslIp();

module.exports = {
  // Where the shell script's injected <script src> loads the bundled payload from.
  // Custom domain, mapped via Cloud Run domain-mappings to the grass-touchers
  // service (project grass-touchers-b9882344, us-west1) — serves both the
  // static payload and the API from the same host. No trailing slash.
  prodBaseUrl: "https://magiceye.grasstouchers.gg",
  devBaseUrl: `http://${devHost}:8000`,

  // Where the payload POSTs report data. Separate from the URLs above because in dev
  // the payload is served statically (esbuild --serve on :8000) while the API server
  // (npm run server) listens on a different port. In prod both are the same host.
  prodApiBase: "https://magiceye.grasstouchers.gg",
  devApiBase: `http://${devHost}:8080`,

  // Days since a city's last report before the town indicator flags it as
  // needing re-indexing (the red dot). Same for dev and prod.
  staleAfterDays: 3,
};
