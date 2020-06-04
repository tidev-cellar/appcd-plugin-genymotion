# v1.6.2 (Jun 4, 2020)

 * chore: Added API version 2.x.
 * chore: Updated dependencies.

# v1.6.1 (Jan 9, 2020)

 * chore: Switched to new `appcd.apiVersion`.
   [(DAEMON-309)](https://jira.appcelerator.org/browse/DAEMON-309)
 * chore: Updated dependencies.

# v1.6.0 (Dec 17, 2019)

 * feat: Wired up live configuration changes.
   [(DAEMON-198)](https://jira.appcelerator.org/browse/DAEMON-198)
 * chore: Updated dependencies.

# v1.5.0 (Aug 14, 2019)

 * chore: Added Appc Daemon v3 to list of compatible appcd versions.
 * chore: Updated dependencies.

# v1.4.0 (Jun 6, 2019)

 * fix: Updated config to remove redundant `genymotion` namespace.
 * chore: Switched `prepare` script to `prepack`.

# v1.3.0 (Mar 29, 2019)

 * chore: Upgraded to Gulp 4.
 * chore: Update dependencies.
 * chore: Fixed lint warnings.
 * fix: Updated filesystem watching to use new `appcd.fs.watch()` and `appcd.fs.unwatch()` to
   optimize subscriptions. [(DAEMON-253)](https://jira.appcelerator.org/browse/DAEMON-253)

# v1.2.0 (Oct 25, 2018)

 * chore: Moved to `@appcd` scope.
 * chore: Update dependencies.
 * feat: Add Daemon 2.x support.

# v1.1.1 (Apr 13, 2018)

 * fix: Fixed detection of new and deleted Genymotion emulators.
   [(DAEMON-252)](https://jira.appcelerator.org/browse/DAEMON-252)

# v1.1.0 (Apr 9, 2018)

 * fix: Removed `appcd-*` dependencies and locked down the appcd version in the `package.json`.
   [(DAEMON-208)](https://jira.appcelerator.org/browse/DAEMON-208)
 * fix: Fixed URLs in `package.json`.
 * chore: Updated dependencies.

# v1.0.0 (Dec 5, 2017)

 * Initial release.
