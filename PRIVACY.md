# Privacy Policy — GT Magic Eye

**Last updated:** 2026-07-28

GT Magic Eye ("the script", "the tool") is a userscript for the browser game
Grepolis. This policy explains what data the script collects, why, where it
goes, and who controls it.

## Who controls the data

The script and its backend are operated by Grass Touchers ("we", "us"),
reachable at **jakelittle135@gmail.com**.

## What data is sent, and when

The script only sends data to `magiceye.grasstouchers.gg`, and only when you
are logged in and actively use its indexing feature (e.g. opening a city's
Defense tab in Grepolis).

**Account data**, created for you by an administrator (there is no
self-service sign-up):
- Username and a bcrypt-hashed password (we never store or transmit your
  plaintext password)
- Account creation date, last login time, last report time, and
  approval/ban status

**Report data**, submitted when you index a city:
- City ID, city name, and coordinates
- World ID (e.g. `us145`)
- Your in-game player ID and alliance ID
- Troop composition (unit counts) for the city, including support troops
  and, where available, the origin city/player/coordinates of that support
- The time the data was observed
- Your account identity (so a report can be attributed to the submitting
  user) and the script version

**IP address**: like any web request, your IP address is visible to our
server as part of the HTTP connection. We don't store it alongside your
account or report data.

We do not collect analytics, advertising identifiers, or any data unrelated
to the features above, and the script does not use cookies.

## Custom backend URLs

The script has a setting that lets you point it at a backend other than
`magiceye.grasstouchers.gg`. Everything in this policy describes only the
official backend operated by us. The moment you configure a custom URL,
everything the script would otherwise send us — account credentials, troop
reports, your IP address, etc. — goes to whatever server you pointed it at
instead, and none of the commitments in this policy (what's collected, who
can see it, retention, deletion on request) apply to that server. We have
no visibility into, and no control over, what a custom backend does with
your data. That's between you and whoever operates it. Use custom backends
at your own risk.

## Why we collect it

Report data is what the tool exists to produce: a shared index of city troop
compositions that users and alliance leaders can look up (e.g. to check
whether a report is stale). Account data lets us gate access to invited
users and attribute/rate-limit submissions. IP-based rate limiting protects
accounts from automated attacks.

## Who can see it

Currently, report data is visible to only the administrators of the
database.

In the longer term, report data will be visible only to leaders of your
"team" (a yet-to-be-created software construct) and yourself. We do not
sell, rent, or share this data with third parties for any purpose.

## Disclosure for legal reasons

We may disclose account or report data if we believe in good faith that
doing so is necessary to comply with a legal obligation, protect the
rights, property, or safety of Grass Touchers, our users, or the public, or
investigate suspected abuse of the Service.

## Security

Passwords are hashed with bcrypt and never stored in plaintext, and the
reporting API requires a valid signed login token. That said, no online
service can guarantee perfect security — use a password for this tool that
you don't reuse elsewhere.

## Data retention

Reports and account records are retained indefinitely in our database so
the index stays useful over time. If you'd like your account or submitted
data deleted, email **jakelittle135@gmail.com** and we will remove it.

## Children's privacy

This tool is an add-on for a game and is not directed at children. We don't
knowingly collect data from children. If you believe a child has provided
us data, contact us and we'll remove it.

## Changes to this policy

If what we collect or how we use it changes, we'll update this document and
its "Last updated" date. Continued use of the script after an update means
you accept the revised policy.

## Contact

Questions, deletion requests, or concerns: **jakelittle135@gmail.com**.
