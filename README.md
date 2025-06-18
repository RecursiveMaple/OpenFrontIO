# OpenFrontIO - rm-v23 Branch

## 1. Project Introduction

This is a personal fork of OpenFrontIO, derived from the [OpenFrontIO main repository](https://github.com/openfrontio/OpenFrontIO). I have implemented several enhancements to the game client based on my preferences, primarily by integrating quick operation features.

All modifications in this repository are contained within the `rm-v23` branch, and the usage method remains consistent with the original repository. The newly introduced quick operation system makes in-game actions more intuitive and efficient. You can first familiarize yourself with this quick operation system in single-player mode.

All changes are client-only, relying on official server (openfront.io) to run online multiplayer game.

Please note that the client does not support internationalization, and newly added English text lacks multi-language capabilities.

If you encounter any issues or bugs, feel free to report them in the issues section.

## 2. Quick Start

### Run from Source (For Users with Development Experience)

For environment setup and code cloning, please refer to the quickstart tutorial in the [OpenFrontIO main repository](https://github.com/openfrontio/OpenFrontIO). After cloning, remember to switch to the `rm-v23` branch:

```bash
git checkout rm-v23
```

The subsequent steps are identical; run the following command instead to launch the client:

```bash
npm run start:client
```

### Beginner's Guide (For Users without Development Experience)

> Note: The following guide is AI-generated

1. Install Required Tools:

   - Install Node.js: Visit the [Node.js website](https://nodejs.org/) and install the latest LTS version.
   - Install Git: Visit the [Git website](https://git-scm.com/) and install Git.

2. Get the Code:

   - Choose a directory where you wish to store the game code.
   - Right-click within that directory and select "Git Bash Here" (Windows) or open your terminal (Mac/Linux).
   - Execute the following commands:

   ```bash
   git clone https://github.com/RecursiveMaple/OpenFrontIO.git
   cd OpenFrontIO
   git checkout rm-v23
   ```

3. Install Dependencies:

   ```bash
   npm i
   ```

4. Start the Game:

   ```bash
   npm run start:client
   ```

The game will automatically open in your default browser.

## 3. Hotkey Bindings

### Changes to Hotkeys

The `rm-v23` branch introduces the following adjustments to the original hotkey system:

**Removed Hotkeys:**

- Continuous WASD/Arrow key movement → Changed to one tile movement per arrow key press.
- Spacebar toggle view → Changed to the backtick key (`).
- C key view focus → Removed.
- QE zoom → Removed.
- Plus/minus zoom → Removed.
- Number keys 1/2 attack ratio adjustment → Changed to number keys [0-9] to directly set ratio from 10% to 100%; Shift+[0-9] to set from 1% to 10%.

**Retained Hotkeys:**

- Escape - Close view.
- Alt+R - Refresh graphics.
- Ctrl+Left Click - Open build menu.
- Alt+Left Click - Open emoji menu.

### New Quick Operations

Usage:

1. Hold the corresponding key to enter operation mode.
2. Left-click to execute the operation at the current position; multiple consecutive clicks are supported.
3. Some operations (e.g., ship attacks, chat) allow for optional right-click pre-selection of additional objects.

An icon indicating the current operation will appear at the mouse cursor position; red signifies that the operation is not executable, while green indicates it is executable. Current hotkeys cannot be re-bound within settings, but you can attempt to modify them directly in the code. Here are all available quick operations:

- [B]oat Attack (B key) - Initiates a ship attack. (Right-click to select the ship's departure point; the outer circle ring turns green when a coastal tile can be selected as a departure point, and a successful right-click selection adds a yellow background indicator. The game usually auto-calculates the optimal departure point.)
- Single Troop Ship Attack (Spacebar) - Same as above, but dispatches only 1 Troop (can be used for harassment, though not strategically important).
- Send Alliance Request (= key) - Sends an alliance request to another player.
- Break Alliance (- key) - Terminates an alliance relationship.
- Donate [T]roops (T key) - Donates the current ratio of troops to an ally (unavailable in FFA mode).
- Donate [M]oney (M key) - Donates 33% of gold to an ally (donation ratio cannot be selected, and unavailable in FFA mode).
- Build [C]ity (C key) - Builds a City.
- Build [D]efense Post (D key) - Builds a Defense Post, displays its defense range.
- Build [S]ilo (S key) - Builds a Missile Silo.
- Build [L]auncher (L key) - Builds a SAM Launcher, displays its outer search range and inner MIRV protection range.
- Build [P]ort (P key) - Builds a Port.
- Build [W]arship (W key) - Builds a Warship.
- Build [A]tom Bomb (A key) - Builds an Atom Bomb, displays its inner and outer explosion ranges.
- Build MI[R]V (V key) - Builds an MIRV, displays its attack range and warhead separation points (green circles).
- Build [H]ydrogen Bomb (H key) - Builds a Hydrogen Bomb, displays its inner and outer explosion ranges.
- Target (O key) - Marks a target player.
- Send [E]moji (E key) - Clicks a target player to open the Emoji interface and send an emoji.
- Send Chat (/ key) - Left-clicks a chat target to open the chat interface (can pre-select [P1] player with a right-click; a successful P1 select adds a yellow background indicator); clicks a message to send directly.

## 4. Other Changes

- **Ad Removal** - Advertisements have been removed.

- **Events Panel Improvements** - The event display method has been adjusted, now utilizing images combined with text to present events, while also fine-tuning durations and priorities for different events. The font size has been reduced.

- **Leaderboard Enhancements** - Added ΔG, Cities, and Ports rankings. ΔG represents a player's recent gold growth rate (money-making ability). Click the header to sort in descending order. The font size has been reduced.

- **Population Control Panel Optimization** - Added "population to population cap ratio" after current population; Added "attack troops to population cap ratio" after attack ratio; The attack ratio background red bar now indicates the position of fastest population growth. In the current version, population grows fastest at around 42% of the population cap; the red bar shows what attack ratio will bring the population to 42% (this has been found to be difficult to use as a strategic guide, intended for reference only). The font size has been reduced.

- **Emoji Table Adjustment** - The table size has been reduced to fit completely on my 1080p display without scrollbars.

- **Chat Interface Improvements** - The interface size has been reduced. The design has been flattened, removing the multi-level menu structure. Only "help," "attack," and "defend" columns have been retained. The send button has been removed; messages are sent directly by clicking them.

- **Territory Display Enhancement** - In-game, when territory drops below 100 tiles, attacks trigger a rapid capture mechanism. Yellow grids of different densities have been added to the territory layer, and player territory is highlighted when dropping below 800, 400, and 200 thresholds.

- **Others** - Other changes I may have forgotten.
