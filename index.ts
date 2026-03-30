import * as vortex from 'vortex-api';
import * as path from 'path';
import Bluebird from 'bluebird';
import { fs, log, util } from 'vortex-api';

type IExtensionContext = vortex.types.IExtensionContext;
type IExtensionApi = vortex.types.IExtensionApi;
type IDiscoveryResult = vortex.types.IDiscoveryResult;
type TestSupported = vortex.types.TestSupported;
type InstallFunc = vortex.types.InstallFunc;
type IInstruction = vortex.types.IInstruction;

const GAME = {
    id: 'plantsvszombiesreplanted',
    name: 'Plants vs Zombies: Replanted',
    exe: 'Replanted.exe',
    steamAppId: '3654560',
    requiredFiles: [
        'Replanted.exe'
    ]
};

const MELON_LOADER = {
    name: 'MelonLoader',
    modFile: '.dll',
    userDataFile: '.cfg',
    detectorFile: '_melonloader',
    keepStructureFile: '_keepstructure',
    modDir: 'Mods',
    userDataDir: 'UserData',
    requiredFiles: [
        path.join('MelonLoader', 'net6', 'MelonLoader.dll'),
    ],
    modPage: 'https://melonwiki.xyz',
    downloadPage: 'https://github.com/LavaGang/MelonLoader/releases/latest',
};


// -------------------------------------
//#region Register Game
// -------------------------------------

/**
 * Vortex extension entry point for Plants vs Zombies: Replanted.
 *
 * Registers the game and sets up mod installers for MelonLoader
 *
 * @param context - Vortex extension context supplied by the host.
 * @returns True if the extension initialized successfully.
 */
function main(context: IExtensionContext): boolean {
    // Register game here
    context.registerGame({
        id: GAME.id,
        name: GAME.name,
        mergeMods: true,
        queryPath: () => Bluebird.resolve(findGame()),
        supportedTools: [],
        queryModPath: () => 'Mods',
        logo: 'gameart.jpg',
        executable: () => GAME.exe,
        requiredFiles: GAME.requiredFiles,
        setup: (discovery) => Bluebird.resolve(prepareForModding(discovery, context.api)),
        environment: { SteamAPPId: GAME.steamAppId },
        details: { steamAppId: GAME.steamAppId },
    });

    // Register mod installer
    context.registerInstaller('pvzre-mod', 25, testSupportedContent, installContent);

    return true;
}

/**
 * Locates the Plants vs Zombies: Replanted installation directory.
 *
 * Uses Vortex's `GameStoreHelper` to find the game by its store app ID.
 *
 * @returns A promise that resolves to the game installation path.
 */
async function findGame(): Promise<string> {
    const game = await util.GameStoreHelper.findByAppId([GAME.steamAppId]);
    return game.gamePath;
}

/**
 * Prepares the game installation for modding.
 *
 * Detects whether MelonLoader is installed
 * Detects whether the mods folder is writable
 *
 * @param discovery - The game discovery result from Vortex.
 * @param api - Vortex extension API.
 * @returns A promise that resolves once preparation is complete.
 */
async function prepareForModding(discovery: IDiscoveryResult, api: IExtensionApi): Promise<void> {
    if (!isMelonLoaderInstalled(discovery)) {
        api.sendNotification!({
            id: 'ml-missing',
            type: 'warning',
            title: 'MelonLoader not installed',
            message: 'MelonLoader is required to mod Plants vs Zombies: Replanted.',
            actions: [
                apiMakeOpenUrlFunction('Get', MELON_LOADER.downloadPage),
                apiMakeCheckAndDismissFunction('Check again', 'ml-or-bix-missing', api, () => isMelonLoaderInstalled(discovery)),
            ],
        });
        return;
    }

    await ensureWritableDirOrWarn(api, path.join(discovery.path!, MELON_LOADER.modDir));
}

//#endregion


// -------------------------------------
//#region Mod installers
// -------------------------------------

/**
 * Test function for new-engine MelonLoader archives.
 *
 * Conditions (in order):
 * - Only supports Plants vs Zombies: Replanted.
 * - Looks for `.dll` mod files.
 * - Prefers explicit MelonLoader markers (special filenames or name matches).
 *
 * @param files - List of files contained in the archive.
 * @param gameId - ID of the game the archive is being installed for.
 * @returns A promise resolving to the support state and required files.
 * @function
 */
const testSupportedContent: TestSupported = (files, gameId) => {
    // Make sure we're able to support this mod.
    if (gameId !== GAME.id) {
        return Bluebird.resolve({ supported: false, requiredFiles: [] });
    }

    const filesIncludeModFile = files.some(file => path.extname(file).toLowerCase() === MELON_LOADER.modFile);
    const filesSignalMelonLoader =
        (files.some(file => path.basename(file).toLowerCase() === MELON_LOADER.detectorFile)) ||
        (files.some(file => file.toLowerCase().includes(MELON_LOADER.name.toLowerCase())));

    if (filesSignalMelonLoader) {
        return Bluebird.resolve({ supported: filesIncludeModFile, requiredFiles: [] });
    }

    return Bluebird.resolve({ supported: filesIncludeModFile, requiredFiles: [] });
};

/**
 * Installer implementation for MelonLoader mods.
 *
 * When a special `_keepstructure` marker is present, the original archive
 * folder structure is preserved. Otherwise, DLLs are placed into MelonLoader's
 * mods directory and CFG files into its UserData directory.
 *
 * @param files - Files contained in the archive.
 * @returns A promise resolving to installer instructions.
 * @function
 */
const installContent: InstallFunc = (files) => {
    const keepStructure = files.some(file => path.basename(file).toLowerCase() === MELON_LOADER.keepStructureFile);

    // Strip directories and the keep-structure marker
    const filtered = files.filter(file =>
        !file.endsWith(path.sep) &&
        path.basename(file).toLowerCase() !== MELON_LOADER.keepStructureFile
    );

    let instructions: IInstruction[] = [];

    if (keepStructure) {
        instructions = filtered.map(file => ({
            type: 'copy',
            source: file,
            destination: file, // keep structure from archive
        }));
    } else {
        // Don't keep structure: only place relevant files in the proper folders
        const dllFiles = filtered.filter(file => path.extname(file).toLowerCase() === MELON_LOADER.modFile);
        const cfgFiles = filtered.filter(file => path.extname(file).toLowerCase() === MELON_LOADER.userDataFile);

        const dllInstructions: IInstruction[] = dllFiles.map(file => ({
            type: 'copy',
            source: file,
            destination: path.join(MELON_LOADER.modDir, path.basename(file)),
        }));

        const cfgInstructions: IInstruction[] = cfgFiles.map(file => ({
            type: 'copy',
            source: file,
            destination: path.join(MELON_LOADER.userDataDir, path.basename(file)),
        }));

        instructions = [...dllInstructions, ...cfgInstructions];
    }

    return Bluebird.resolve({ instructions });
};
//#endregion

// -------------------------------------
//#region Utils
// -------------------------------------

/**
 * Checks if MelonLoader is installed for a given discovery.
 *
 * Looks for all MelonLoader required files under the game directory.
 *
 * @param discovery - The game discovery result from Vortex.
 * @returns True if all required MelonLoader files exist; otherwise false.
 */
function isMelonLoaderInstalled(discovery: IDiscoveryResult) {
    for (const reqFile of MELON_LOADER.requiredFiles) {
        try {
            fs.statSync(path.join(discovery.path!, reqFile));
        } catch {
            return false;
        }
    }
    return true;
}

/**
 * Ensures that a directory exists and is writable, otherwise warns the user.
 *
 * If the directory is not writable, an error is logged and a Vortex notification
 * is shown describing the problem and offering to open the folder.
 *
 * @param api - Vortex extension API.
 * @param absPath - Absolute path of the directory to check.
 * @returns A promise resolving to true if the directory is writable, false otherwise.
 */
async function ensureWritableDirOrWarn(api: IExtensionApi, absPath: string) {
    try {
        await fs.ensureDirWritableAsync(absPath);
        return true;
    } catch (err: any) {
        log('error', `Directory "${absPath}" is not writable: ${err}`);
        api.sendNotification?.({
            id: 'vs-support-writable-warning',
            type: 'warning',
            title: 'Directory Permissions Warning',
            message: `Directory "${absPath}" is not writable. Please ensure you have the necessary permissions to write to this directory.`,
            actions: [
                apiMakeOpenUrlFunction('Open folder', absPath),
            ],
        });
        return false;
    }
}

/**
 * Creates a Vortex notification action that opens a URL using `util.opn`.
 *
 * @param title - Display title of the action button.
 * @param url - URL to open when the action is invoked.
 * @returns A notification action descriptor.
 */
function apiMakeOpenUrlFunction(title: string, url: string) {
    return {
        title,
        action: () => util.opn(url).catch(() => undefined),
    };
}

/**
 * Creates a Vortex notification action that re-checks a condition and
 * dismisses a notification if the condition is now satisfied.
 *
 * Typically used to allow the user to click "Check again" after installing
 * a mod loader manually.
 *
 * @param title - Display title of the action button.
 * @param notificationId - ID of the notification to potentially dismiss.
 * @param api - Vortex extension API.
 * @param checkFunction - Function that returns true when the condition is satisfied.
 * @returns A notification action descriptor.
 */
function apiMakeCheckAndDismissFunction(title: string, notificationId: string, api: IExtensionApi, checkFunction: () => boolean) {
    return {
        title,
        action: () => apiCheckAndDismissFunction(notificationId, api, checkFunction),
    };
}

/**
 * Checks a condition and dismisses the specified notification if it holds.
 *
 * @param notificationId - ID of the notification to dismiss.
 * @param api - Vortex extension API.
 * @param checkFunction - Condition function; if it returns true, the notification is dismissed.
 */
function apiCheckAndDismissFunction(notificationId: string, api: IExtensionApi, checkFunction: () => boolean) {
    if (checkFunction()) {
        api.dismissNotification?.(notificationId);
    }
}

//#endregion

// export only for typedoc
export {
    // Register / setup
    main,
    findGame,
    prepareForModding,

    // Installers & helpers
    testSupportedContent,
    installContent,

    // Mod loader detection
    isMelonLoaderInstalled,

    // Utility functions
    ensureWritableDirOrWarn,
    apiMakeOpenUrlFunction,
    apiMakeCheckAndDismissFunction,
    apiCheckAndDismissFunction,
};

export default main;
