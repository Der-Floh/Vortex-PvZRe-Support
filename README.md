# Plants vs Zombies: Replanted Support for [Vortex](https://www.nexusmods.com/about/vortex/)

## Description

This extension adds support for Plants vs Zombies: Replanted to [Vortex Mod Manager](https://www.nexusmods.com/about/vortex/), enabling you to easily automate installation of mods for Plants vs Zombies: Replanted without having to worry about where the files are supposed to go, etc.

## How to install

This extension requires Vortex. To install, simply search the game name in Vortex and click "manage". Alternatively, within Vortex, go to the Extensions tab, click "Find More" at the bottom of the tab, search for "Plants vs Zombies: Replanted" and then click Install.

You can also manually install it by downloading the archive file from the [Latest Release](https://github.com/Der-Floh/Vortex-PvZRe-Support/releases/latest) and dragging it into the "drop zone" labelled "Drop File(s)" in the Extensions tab at the bottom right.

Afterwards, restart Vortex and you can begin installing supported Plants vs Zombies: Replanted mods with Vortex.

## Mod Loader

This extension requires you to install [MelonLoader](https://melonwiki.xyz) for the game. A guide on how to do that can be found [here](https://melonwiki.xyz/#/?id=what-is-melonloader).

## How to build

To build the extension from source:

1. **Install prerequisites**
   - Make sure you have **Node.js** and **npm** installed.

2. **Clone the repository**
   ```bash
   git clone https://github.com/Der-Floh/Vortex-PvZRe-Support.git
   cd Vortex-PvZRe-Support
   ```

3. **Install dependencies**
   You can either use the helper script:

   ```bash
   npm run install-deps
   ```

   or run the equivalent command directly:

   ```bash
   npm install --ignore-scripts
   ```

4. **Build the extension**
   ```bash
   npm run build
   ```

   This compiles the TypeScript source (including `index.ts`) into JavaScript and outputs it to `dist/index.js`, which is the file Vortex uses.

5. **Package the extension (optional)**
   If you want a distributable `.zip` archive (like the ones used for releases), run:

   ```bash
   npm run package
   ```

   This will:

   - Build the project (if not already built),
   - Collect `dist/index.js`, `gameart.jpg`, and `info.json` into a temporary `.pack` directory,
   - Create a zip file at:

     ```text
     dist/pvzre-support-1.0.0.zip
     ```

     (the name is based on the `name` and `version` in `package.json`).

You can then use that `.zip` file as the extension archive in Vortex, or for publishing new releases.
