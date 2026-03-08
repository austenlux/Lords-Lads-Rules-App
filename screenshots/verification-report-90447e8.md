# Verification Report — A1 follow-up fix (commit 90447e8)

**Build:** `npm run sync:build-info && npm run install:ios:release`  
**Commit:** 90447e8 — A1 iOS: draw background logo inside content wrapper so it renders on iOS  
**Date:** 2026-03-08  

---

## Verification environment

- **Platform:** iOS Simulator  
- **Device:** iPhone 16 Pro (id: F935399C-5069-4766-BCF2-F77E87007402)  
- **OS:** iOS 18.3.1  
- **App:** Lords and Lads Rules, release build, bundle ID `com.lux.lnlrules`  

---

## A1: Background logo and semi-transparent overlay (Rules tab)

**Result: FAIL**

On the Rules tab (default), the content area shows a **solid dark grey/black background**. The centered background logo (`logo_dark_greyscale`) and the semi-transparent overlay are **not visible** behind the content.

**Evidence:** `screenshots/ios-rules-after-90447e8.png`

**Other tabs:** Expansions, Tools, and More were not checked (tab switching via automation was attempted but did not change the active tab; manual verification was not performed).

---

## A2: Tools screen — full-width sections

**Result: Not verified**

The Tools tab was not opened during this run. Tab bar tap (AppleScript) did not switch the app from Rules. A2 is not verified.

---

## A3: More screen — nail buttons show icons

**Result: Not verified**

The More tab was not opened. A3 is not verified.

---

## Defects

### D1 — Background logo still not visible on iOS (Rules tab)

| Field | Value |
|-------|--------|
| **Title** | Background logo and overlay not visible on iOS after in-content-wrapper fix |
| **Severity** | Major |
| **Platform** | iOS Simulator, iPhone 16 Pro, iOS 18.3.1 |
| **Steps** | 1. Build and install release app (90447e8). 2. Launch app. 3. Observe Rules tab (default). |
| **Expected** | Centered `logo_dark_greyscale` and semi-transparent overlay visible behind Rules content. |
| **Actual** | Solid dark background only; no logo or overlay. |
| **Evidence** | `screenshots/ios-rules-after-90447e8.png` |

---

## Sign-off

**Status: BLOCKED**

A1 remains failing. The background layer is implemented as the first child inside the content wrapper (absolute-positioned, with logo + overlay), but it does not appear on iOS Simulator. Possible causes: absolute-view layout/stacking on iOS, or an opaque layer elsewhere covering it. A2 and A3 were not verified due to inability to switch tabs in this run.

---

## Completion summary

- A1: **FAIL** — logo/overlay not visible on Rules tab  
- A2: **Not verified** — Tools tab not opened  
- A3: **Not verified** — More tab not opened  
- Defects: 1 (D1 — background logo not visible, major)  
- Screenshots: 2 (Rules tab, post–Tools-tap still Rules)  
- Sign-off: **Blocked**
