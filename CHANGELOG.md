# Changelog

All notable changes to this plugin are documented here.

## [0.2.4] - 2026-09-20

### Added

- Display the generated DSH Callback URL with a copy button.
- Add a shortcut button to open the X Developer Console.

## [0.2.3] - 2026-09-20

### Fixed

- Fixed backend startup so the Client ID settings route is registered instead of failing on API URL normalization.
- Added regression coverage for trailing API base URL slash normalization.

## [0.2.2] - 2026-09-20

### Fixed

- Align the Client ID input with DSH light and dark theme colors, including placeholder and focus states.

## [0.2.1] - 2026-09-20

### Fixed

- The X authorization button now saves an entered Client ID before opening the authorization page.

## [0.2.0] - 2026-09-20

### Added

- Visual DSH Web settings for editing and persisting the X Client ID.
- A button to open the X OAuth authorization page from Settings > X Publisher.
- Authorization status and current account display with manual refresh.
- SemVer release checks, changelog validation, and tag-based GitHub Release automation.

### Changed

- X Client ID settings saved in DSH credentials take precedence over the legacy environment fallback.

## [0.1.0] - Unreleased

### Added

- Standalone DSH bundle plugin for X OAuth 2.0 PKCE authorization.
- X account status and official API posting tools.
- Automatic loopback OAuth callback URI derived from the DSH Web Server.
